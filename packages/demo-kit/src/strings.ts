import type { Locale } from '@peera/i18n';

/** Built-in strings of the demo chrome. Product copy belongs in each app's messages. */
export const kitStrings = {
  en: {
    sampleData: 'Sample data',
    role: 'Role',
    demoMenu: 'Demo menu',
    reset: 'Reset',
    resetTitle: 'Reset the demo?',
    resetBody:
      'Everything goes back to the original sample data. What you added or changed will be gone.',
    resetConfirm: 'Reset the demo',
    cancel: 'Cancel',
    openInNewTab: 'Open in new tab',
    contact: 'Want a system like this?',
    sampleNotice:
      'Everything in this demo is made up: the people, shops and numbers are not real.',
    tourLabel: 'How to try this demo',
    tourStep: 'Step {n} of {total}',
    tourNext: 'Next',
    tourBack: 'Back',
    tourDone: 'Got it',
    tourSkip: 'Skip',
    officialAccount: 'Official account',
    chatCaption: 'Preview of the message sent to LINE in the real system',
    chatLog: 'Chat messages',
    quickReplies: 'Quick replies',
  },
  th: {
    sampleData: 'ข้อมูลตัวอย่าง',
    role: 'บทบาท',
    demoMenu: 'เมนูเดโม',
    reset: 'เริ่มใหม่',
    resetTitle: 'เริ่มเดโมใหม่ไหม',
    resetBody:
      'ข้อมูลทั้งหมดจะกลับเป็นข้อมูลตัวอย่างตั้งต้น สิ่งที่คุณเพิ่มหรือแก้ไขไว้จะหายไป',
    resetConfirm: 'เริ่มเดโมใหม่',
    cancel: 'ยกเลิก',
    openInNewTab: 'เปิดในแท็บใหม่',
    contact: 'อยากได้ระบบแบบนี้',
    sampleNotice:
      'ข้อมูลในเดโมนี้เป็นข้อมูลสมมติทั้งหมด ทั้งชื่อคน ชื่อร้าน และตัวเลข',
    tourLabel: 'วิธีลองใช้เดโมนี้',
    tourStep: 'ขั้นที่ {n} จาก {total}',
    tourNext: 'ถัดไป',
    tourBack: 'ย้อนกลับ',
    tourDone: 'เข้าใจแล้ว',
    tourSkip: 'ข้าม',
    officialAccount: 'บัญชีทางการ',
    chatCaption: 'ตัวอย่างข้อความที่จะส่งเข้า LINE จริง',
    chatLog: 'ข้อความในแชต',
    quickReplies: 'ตัวเลือกตอบกลับด่วน',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type KitStrings = (typeof kitStrings)['en'];
