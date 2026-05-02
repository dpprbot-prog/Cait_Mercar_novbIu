import * as XLSX from 'xlsx'

/**
 * Генерирует XLSX файл из массива объектов.
 * Возвращает Base64 строку для передачи через Server Actions.
 */
/**
 * Генерирует XLSX файл. Поддерживает одну или несколько вкладок.
 * @param data Либо массив объектов (одна вкладка), либо объект { [sheetName]: dataArray } (несколько вкладок)
 */
export function generateExcelBase64(data: any[] | Record<string, any[]>, defaultSheetName: string = 'Sheet1'): string {
  const workbook = XLSX.utils.book_new()
  
  if (Array.isArray(data)) {
    const worksheet = XLSX.utils.json_to_sheet(data)
    XLSX.utils.book_append_sheet(workbook, worksheet, defaultSheetName)
  } else {
    for (const [sheetName, sheetData] of Object.entries(data)) {
      const worksheet = XLSX.utils.json_to_sheet(sheetData)
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
    }
  }
  
  const buf = XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
  return buf
}
