import { MAX_PHOTO_CHARS, photoDataUrl, validRecipePhoto } from './recipePhotoData'

declare const wx: { env: { USER_DATA_PATH: string } }
const sizes = [480, 400, 320, 240]

export async function chooseRecipePhoto(): Promise<string> {
  // #ifdef H5
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp'
    input.style.display = 'none'; document.body.appendChild(input)
    input.oncancel = () => { input.remove(); resolve('') }
    input.onchange = async () => {
      const file = input.files?.[0]; input.remove()
      if (!file) { resolve(''); return }
      if (file.size > 12 * 1024 * 1024) { reject(new Error('照片超过 12 MB，请选择较小的图片')); return }
      const url = URL.createObjectURL(file)
      try {
        const image = await new Promise<HTMLImageElement>((done, fail) => {
          const image = new Image(); image.onload = () => done(image)
          image.onerror = () => fail(new Error('图片无法读取，请选择 JPG、PNG 或 WebP 图片')); image.src = url
        })
        const canvas = document.createElement('canvas'), context = canvas.getContext('2d')
        if (!context) throw new Error('当前浏览器无法处理照片，请换一个浏览器重试')
        for (const size of sizes) {
          const scale = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight))
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
          // Flatten transparency onto the same warm white as the recipe cards.
          context.fillStyle = '#faf9f5'; context.fillRect(0, 0, canvas.width, canvas.height)
          context.drawImage(image, 0, 0, canvas.width, canvas.height)
          const data = canvas.toDataURL('image/jpeg', size === 480 ? .78 : .68)
          if (validRecipePhoto(data)) { resolve(data); return }
        }
        throw new Error('照片细节较多，压缩后仍过大，请换一张较简单的图片')
      } catch (error) { reject(error) }
      finally { URL.revokeObjectURL(url) }
    }
    input.click()
  })
  // #endif
  // #ifdef MP-WEIXIN
  const path = await new Promise<string>((resolve, reject) => {
    uni.chooseImage({ count: 1, sizeType: ['original'], sourceType: ['album', 'camera'],
      success: result => resolve(result.tempFilePaths[0] || ''),
      fail: error => /cancel/.test(error.errMsg) ? resolve('') : reject(new Error('无法选择照片，请检查相册或相机权限后重试')) })
  })
  if (!path) return ''
  const info = await new Promise<UniApp.GetImageInfoSuccessData>((resolve, reject) => uni.getImageInfo({ src: path, success: resolve, fail: () => reject(new Error('图片无法读取，请换一张 JPG 或 PNG 照片')) }))
  for (const size of sizes) {
    const scale = Math.min(1, size / Math.max(info.width, info.height))
    const compressed = await new Promise<string>((resolve, reject) => uni.compressImage({ src: path, quality: size === 480 ? 78 : 68,
      compressedWidth: Math.max(1, Math.round(info.width * scale)), compressedHeight: Math.max(1, Math.round(info.height * scale)),
      success: result => resolve(result.tempFilePath), fail: () => reject(new Error('照片压缩失败，请换一张照片或更新微信后重试')) }))
    const base64 = await new Promise<string>((resolve, reject) => uni.getFileSystemManager().readFile({ filePath: compressed, encoding: 'base64',
      success: result => typeof result.data === 'string' ? resolve(result.data) : reject(new Error('照片读取失败，请重新选择')),
      fail: () => reject(new Error('照片读取失败，请重新选择')) }))
    if (base64.length + 23 <= MAX_PHOTO_CHARS) return photoDataUrl(base64)
  }
  throw new Error('照片细节较多，压缩后仍过大，请换一张较简单的图片')
  // #endif
  throw new Error('当前平台暂不支持添加照片')
}

const previewCache = new Map<string, Promise<string>>()
let cacheDirectory = ''
let previewNumber = 0
// The encoded photo stays in the journal/backup; these files are disposable WeChat previews.
export async function recipePhotoSource(src: string): Promise<string> {
  // #ifdef MP-WEIXIN
  if (validRecipePhoto(src)) {
    const cached = previewCache.get(src)
    if (cached) return cached
    const pending = new Promise<string>((resolve, reject) => {
      try {
        const fs = uni.getFileSystemManager()
        if (!cacheDirectory) {
          const directory = wx.env.USER_DATA_PATH + '/yikou-photo-previews'
          try { fs.mkdirSync(directory, true) } catch { /* The app-owned directory may already exist. */ }
          // Remove previews from previous launches; persisted photos are always recoverable.
          for (const name of fs.readdirSync(directory)) if (/^photo-\d+\.(jpg|png)$/.test(name)) {
            try { fs.unlinkSync(directory + '/' + name) } catch { /* A stale preview is harmless. */ }
          }
          cacheDirectory = directory
        }
        const filePath = `${cacheDirectory}/photo-${previewNumber++}.${src.startsWith('data:image/jpeg;') ? 'jpg' : 'png'}`
        fs.writeFile({ filePath, data: src.slice(src.indexOf(',') + 1), encoding: 'base64', success: () => resolve(filePath), fail: reject })
      } catch (error) { reject(error) }
    })
    previewCache.set(src, pending)
    try { return await pending } catch (error) { previewCache.delete(src); throw error }
  }
  // #endif
  return src
}
