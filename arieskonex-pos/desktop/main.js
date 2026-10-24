const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// কনফিগ: আপনার অনলাইনে হোস্ট করা অ্যাপের URL
let config = { appUrl: 'https://your-domain.com/login.php' };
try {
    const cfgPath = path.join(__dirname, 'config.json');
    if (fs.existsSync(cfgPath)) {
        config = Object.assign(config, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
    }
} catch (e) {
    console.error('config.json পড়া যায়নি:', e.message);
}

function createWindow() {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 900,
        minHeight: 600,
        autoHideMenuBar: true,
        backgroundColor: '#2C1650',
        title: 'Mallik Book House & Computer',
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    if (fs.existsSync(path.join(__dirname, 'assets', 'icon.png'))) {
        win.setIcon(path.join(__dirname, 'assets', 'icon.png'));
    }

    win.loadURL(config.appUrl);

    // বাইরের লিংক (যেমন নতুন ট্যাবে) ডিফল্ট ব্রাউজারে খোলে
    win.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    // অ্যাপের বাইরের ডোমেইনে নেভিগেশন আটকে দিন (সেশন সুরক্ষা)
    win.webContents.on('will-navigate', (event, url) => {
        const target = new URL(url);
        const allowed = new URL(config.appUrl);
        if (target.origin !== allowed.origin) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    // প্রিন্টে OS ডায়ালগ
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.control && input.key.toLowerCase() === 'p') {
            event.preventDefault();
            win.webContents.print({ silent: false, printBackground: true });
        }
    });

    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        if (errorCode === -3) return; // aborted — স্বাভাবিক
        dialog.showErrorBox(
            'সংযোগ ব্যর্থ হয়েছে',
            `অ্যাপ সার্ভার লোড করা যায়নি।\n\n${config.appUrl}\n\n${errorDescription}\n\nইন্টারনেট সংযোগ ও সার্ভার অ্যাক্টিভ কিনা যাচাই করুন।`
        );
    });
}

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
