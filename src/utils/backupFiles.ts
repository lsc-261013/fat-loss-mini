const MAX_BYTES = 4 * 1024 * 1024
declare const wx: {
  env: { USER_DATA_PATH: string }
  getFileSystemManager(): {
    writeFile(options: { filePath: string; data: string; encoding: string; success: () => void; fail: (e: unknown) => void }): void
    readFile(options: { filePath: string; encoding: string; success: (r: { data: string }) => void; fail: (e: unknown) => void }): void
  }
  shareFileMessage(options: { filePath: string; fileName: string; success: () => void; fail: (e: unknown) => void }): void
  chooseMessageFile(options: { count: number; type: string; extension: string[]; success: (r: { tempFiles: { path: string; size: number }[] }) => void; fail: (e: unknown) => void }): void
}
export async function saveBackupFile(content: string, fileName: string): Promise<void> {
  // #ifdef H5
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a'); link.href = url; link.download = fileName
  document.body.appendChild(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30000)
  // #endif
  // #ifdef MP-WEIXIN
  await new Promise<void>((resolve, reject) => {
    const filePath = wx.env.USER_DATA_PATH + '/' + fileName
    wx.getFileSystemManager().writeFile({ filePath, data: content, encoding: 'utf8', fail: reject, success: () => {
      wx.shareFileMessage({ filePath, fileName, success: resolve, fail: reject })
    } })
  })
  // #endif
}
export async function chooseBackupFile(): Promise<string> {
  // #ifdef H5
  return new Promise<string>((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'
    input.style.display = 'none'; document.body.appendChild(input)
    input.oncancel = () => { input.remove(); reject(new Error('已取消选择')) }
    input.onchange = async () => {
      const file = input.files?.[0]
      input.remove()
      if (!file) { reject(new Error('未选择文件')); return }
      if (file.size > MAX_BYTES) { reject(new Error('备份不能超过 4 MB')); return }
      try { resolve(await file.text()) } catch { reject(new Error('文件读取失败，请重新选择')) }
    }
    input.click()
  })
  // #endif
  // #ifdef MP-WEIXIN
  return new Promise<string>((resolve, reject) => {
    wx.chooseMessageFile({ count: 1, type: 'file', extension: ['json'], fail: reject, success: result => {
      const file = result.tempFiles[0]
      if (!file || file.size > MAX_BYTES) { reject(new Error('备份不能超过 4 MB')); return }
      wx.getFileSystemManager().readFile({ filePath: file.path, encoding: 'utf8', success: r => resolve(r.data), fail: reject })
    } })
  })
  // #endif
  throw new Error('当前平台暂不支持文件导入')
}
