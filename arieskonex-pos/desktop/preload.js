// প্রি-লোড: কনটেক্সট আইসোলেশনে নিরাপদ ব্রিজ।
// বর্তমানে কোনো অতিরিক্ত API দরকার নেই — ভবিষ্যতে (যেমন অফলাইন সিঙ্ক/প্রিন্ট)
// যোগ করার জন্য এই ফাইলটি রাখা হয়েছে।
const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('mallikDesktop', {
    isDesktop: true,
    platform: process.platform
});
