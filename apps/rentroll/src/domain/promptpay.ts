import { assertSatang, type Satang } from './money';

/**
 * CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), the checksum at the end of an EMVCo QR payload. The check value of
 * "123456789" is 0x29B1.
 */
export function crc16Ccitt(input: string): number {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i += 1) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/**
 * The EMVCo payload PromptPay reads, with the amount when given. Used by tests and the developer note only: the demo
 * never renders a payable QR (01 §6.3). `phone` is a Thai mobile number (0812345678); `taxId` is 13 digits.
 */
export function promptPayPayload({
  target,
  amount,
}: {
  target: { kind: 'phone'; value: string } | { kind: 'taxId'; value: string };
  amount?: Satang;
}): string {
  const account =
    target.kind === 'phone'
      ? tlv('01', `0066${target.value.replace(/\D/g, '').replace(/^0/, '')}`)
      : tlv('02', target.value.replace(/\D/g, ''));
  let payload =
    tlv('00', '01') +
    tlv('01', amount === undefined ? '11' : '12') +
    tlv('29', tlv('00', 'A000000677010111') + account) +
    tlv('53', '764');
  if (amount !== undefined)
    payload += tlv('54', (assertSatang(amount, 'amount') / 100).toFixed(2));
  payload += tlv('58', 'TH') + '6304';
  return (
    payload + crc16Ccitt(payload).toString(16).toUpperCase().padStart(4, '0')
  );
}
