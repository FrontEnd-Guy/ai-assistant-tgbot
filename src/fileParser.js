import pdf from 'pdf-parse';
import textract from 'textract';
import XLSX from 'xlsx';

export async function parsePdf(buffer) {
  const data = await pdf(buffer);
  return data.text;
}

export async function parseDocx(buffer) {
  return new Promise((resolve, reject) => {
    textract.fromBufferWithMime('application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer, (error, text) => {
      if (error) reject(error);
      else resolve(text);
    });
  });
}

export async function parseExcel(buffer) {
  const workbook = XLSX.read(buffer, {type: 'buffer'});
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_csv(sheet);
}
