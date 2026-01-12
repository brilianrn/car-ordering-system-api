import { Injectable } from '@nestjs/common';
import { createWorker } from 'tesseract.js';
import { globalLogger as Logger } from './logger';
import { CostCategory } from '@/packages/cost-variable/dto/create-cost-variable.dto';

export interface OCRResult {
  text: string;
  confidence: number;
}

export interface ParsedReceiptData {
  category?: CostCategory;
  amountIdr?: number;
  receiptDate?: string; // ISO 8601 date string
  rawText: string;
  confidence: number;
}

@Injectable()
export class OCRService {
  /**
   * Extract text from image using OCR
   * @param imageUrl - URL or base64 string of the image
   * @returns OCR result with extracted text and confidence
   */
  async extractText(imageUrl: string): Promise<OCRResult> {
    try {
      const worker = await createWorker('ind+eng'); // Indonesian + English

      try {
        const { data } = await worker.recognize(imageUrl);
        await worker.terminate();

        return {
          text: data.text,
          confidence: data.confidence,
        };
      } catch (error) {
        await worker.terminate();
        throw error;
      }
    } catch (error) {
      Logger.error(
        error instanceof Error ? error.message : 'Error in OCR extraction',
        error instanceof Error ? error.stack : undefined,
        'OCRService.extractText',
      );
      throw error;
    }
  }

  /**
   * Parse receipt data from OCR text
   * Extracts: category, amount, and date
   */
  parseReceiptData(ocrText: string, confidence: number): ParsedReceiptData {
    const text = ocrText.toLowerCase();
    const result: ParsedReceiptData = {
      rawText: ocrText,
      confidence,
    };

    // Extract category
    result.category = this.extractCategory(text);

    // Extract amount
    result.amountIdr = this.extractAmount(text);

    // Extract date
    result.receiptDate = this.extractDate(text);

    return result;
  }

  /**
   * Extract category from receipt text
   */
  private extractCategory(text: string): CostCategory | undefined {
    // Keywords for each category
    const categoryKeywords: Record<CostCategory, string[]> = {
      FUEL: ['bbm', 'bensin', 'pertalite', 'pertamax', 'solar', 'premium', 'fuel', 'gasoline'],
      TOLL: ['tol', 'toll', 'jalan tol', 'gerbang tol'],
      PARKING: ['parkir', 'parking', 'biaya parkir'],
      DRIVER: ['driver', 'sopir', 'uang makan driver', 'makan driver'],
      VEHICLE_MAINTENANCE: ['service', 'servis', 'maintenance', 'perbaikan', 'sparepart', 'suku cadang'],
      OTHER: [],
    };

    // Check each category
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (category === 'OTHER') continue;

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          return category as CostCategory;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract amount from receipt text
   * Looks for patterns like: Rp 50.000, IDR 50000, 50000, etc.
   */
  private extractAmount(text: string): number | undefined {
    // Remove common separators and normalize
    const normalizedText = text.replace(/[.,\s]/g, '');

    // Pattern 1: Rp followed by numbers (Rp50000, Rp 50000, Rp.50000)
    const rupiahPattern = /rp\.?\s*(\d+)/i;
    const rupiahMatch = normalizedText.match(rupiahPattern);
    if (rupiahMatch) {
      const amount = parseInt(rupiahMatch[1], 10);
      if (amount > 0) return amount;
    }

    // Pattern 2: IDR followed by numbers
    const idrPattern = /idr\.?\s*(\d+)/i;
    const idrMatch = normalizedText.match(idrPattern);
    if (idrMatch) {
      const amount = parseInt(idrMatch[1], 10);
      if (amount > 0) return amount;
    }

    // Pattern 3: Large numbers (likely amounts, > 1000)
    // Look for numbers with 4+ digits that appear after "total", "jumlah", "bayar", etc.
    const amountKeywords = ['total', 'jumlah', 'bayar', 'harga', 'price', 'amount'];
    const lines = text.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      const hasKeyword = amountKeywords.some((keyword) => lowerLine.includes(keyword));

      if (hasKeyword) {
        // Extract numbers from this line
        const numbers = line.match(/\d+/g);
        if (numbers) {
          for (const numStr of numbers) {
            const num = parseInt(numStr.replace(/[.,]/g, ''), 10);
            // Amount should be reasonable (between 1,000 and 100,000,000)
            if (num >= 1000 && num <= 100000000) {
              return num;
            }
          }
        }
      }
    }

    // Pattern 4: Last resort - find largest number in text (likely the total)
    const allNumbers = text.match(/\d+/g);
    if (allNumbers) {
      const amounts = allNumbers
        .map((n) => parseInt(n.replace(/[.,]/g, ''), 10))
        .filter((n) => n >= 1000 && n <= 100000000)
        .sort((a, b) => b - a); // Sort descending

      if (amounts.length > 0) {
        return amounts[0]; // Return largest amount
      }
    }

    return undefined;
  }

  /**
   * Extract date from receipt text
   * Looks for patterns like: DD/MM/YYYY, DD-MM-YYYY, DD MMM YYYY, etc.
   */
  private extractDate(text: string): string | undefined {
    const today = new Date();
    const currentYear = today.getFullYear();

    // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
    const datePattern1 = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
    const match1 = text.match(datePattern1);
    if (match1) {
      const day = parseInt(match1[1], 10);
      const month = parseInt(match1[2], 10);
      const year = parseInt(match1[3], 10);

      if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 2020 && year <= currentYear + 1) {
        try {
          const date = new Date(year, month - 1, day);
          if (date.getDate() === day && date.getMonth() === month - 1) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Invalid date
        }
      }
    }

    // Pattern 2: DD MMM YYYY (e.g., "15 Jan 2024")
    const monthNames = [
      'januari',
      'februari',
      'maret',
      'april',
      'mei',
      'juni',
      'juli',
      'agustus',
      'september',
      'oktober',
      'november',
      'desember',
      'jan',
      'feb',
      'mar',
      'apr',
      'may',
      'jun',
      'jul',
      'aug',
      'sep',
      'oct',
      'nov',
      'dec',
    ];

    for (let i = 0; i < monthNames.length; i++) {
      const monthName = monthNames[i];
      const monthIndex = i >= 12 ? i - 12 : i;
      const pattern = new RegExp(`(\\d{1,2})\\s+${monthName}\\s+(\\d{4})`, 'i');
      const match = text.match(pattern);

      if (match) {
        const day = parseInt(match[1], 10);
        const year = parseInt(match[2], 10);

        if (day >= 1 && day <= 31 && year >= 2020 && year <= currentYear + 1) {
          try {
            const date = new Date(year, monthIndex, day);
            if (date.getDate() === day && date.getMonth() === monthIndex) {
              return date.toISOString().split('T')[0];
            }
          } catch (e) {
            // Invalid date
          }
        }
      }
    }

    // Pattern 3: YYYY-MM-DD
    const isoPattern = /(\d{4})-(\d{1,2})-(\d{1,2})/;
    const isoMatch = text.match(isoPattern);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);

      if (year >= 2020 && year <= currentYear + 1 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        try {
          const date = new Date(year, month - 1, day);
          if (date.getDate() === day && date.getMonth() === month - 1) {
            return date.toISOString().split('T')[0];
          }
        } catch (e) {
          // Invalid date
        }
      }
    }

    return undefined;
  }
}
