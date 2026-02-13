import {
  Assignment,
  Booking,
  BookingSegment,
  Driver,
  ReceiptItem,
  SegmentExecution,
  VerificationHeader,
} from '@prisma/client';

/**
 * Finance Driver with Employee Info
 */
export interface IFinanceDriver extends Driver {
  employee?: IFinanceEmployeeInfo | null;
}

/**
 * Partial Employee Info
 */
export interface IFinanceEmployeeInfo {
  employeeId: string;
  fullName: string;
  email: string | null;
}

/**
 * Finance Receipt Item with Verification and Relations
 */
export interface IFinanceReceiptItem extends ReceiptItem {
  verification?: IFinanceVerificationHeader | null;
}

/**
 * Finance Verification Header with Relations
 */
export interface IFinanceVerificationHeader extends VerificationHeader {
  receiptItems?: ReceiptItem[];
  segmentExecution?: IFinanceSegmentExecution | null;
}

/**
 * Finance Segment Execution with Relations
 */
export interface IFinanceSegmentExecution extends SegmentExecution {
  segment?:
    | (BookingSegment & {
        booking?:
          | (Booking & {
              requester?: IFinanceEmployeeInfo | null;
              assignment?:
                | (Assignment & {
                    driverChosen?: IFinanceDriver | null;
                  })
                | null;
            })
          | null;
      })
    | null;
  verification?: IFinanceVerificationHeader | null;
}

/**
 * Finance Booking with Relations
 */
export interface IFinanceBooking extends Booking {
  segments?: (BookingSegment & {
    execution?: IFinanceSegmentExecution | null;
  })[];
  requester?: IFinanceEmployeeInfo | null;
}
