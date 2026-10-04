export const MAX_PHOTO_BYTES = 36 * 1024
export const MAX_PHOTO_CHARS = 4 * Math.ceil(MAX_PHOTO_BYTES / 3) + 23
export const MAX_RECIPE_PHOTO_CHARS = 512 * 1024

// ASCII data URLs occupy one encoded byte per character in the photo budget.
export function recipePhotoChars(recipes: readonly { photo?: string }[]): number {
  return recipes.reduce((total, recipe) => total + (recipe.photo?.length || 0), 0)
}

export class RecipePhotoLimitError extends Error {
  constructor() {
    super('菜谱照片空间不足，请到「食谱管理」清理自选照片后重试；原数据和草稿保留')
    this.name = 'RecipePhotoLimitError'
  }
}

// Only self-contained raster photos are accepted; temporary paths and remote URLs expire.
export function validRecipePhoto(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_PHOTO_CHARS) return false
  const match = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value)
  if (!match || match[2].length % 4 !== 0) return false
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0
  if (match[2].length / 4 * 3 - padding > MAX_PHOTO_BYTES) return false
  return match[1] === 'jpeg' ? match[2].startsWith('/9j/') && match[2].length >= 16 : match[2].startsWith('iVBORw0KGgo') && match[2].length >= 32
}

export function photoDataUrl(base64: string): string {
  const format = base64.startsWith('/9j/') ? 'jpeg' : 'png'
  const result = `data:image/${format};base64,${base64}`
  if (!validRecipePhoto(result)) throw new Error('照片未能压缩到合适大小，请换一张 JPG 或 PNG 图片')
  return result
}
