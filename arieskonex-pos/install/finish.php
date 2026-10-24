<?php
if (session_status() === PHP_SESSION_NONE) session_start();
if (empty($_SESSION['install_done'])) {
    header('Location: index.php');
    exit;
}
unset($_SESSION['install_done']);
?>
<!DOCTYPE html>
<html lang="bn">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ইনস্টলেশন সম্পন্ন</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+Da+2:wght@600;700;800&family=Hind+Siliguri:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.css">
<link rel="stylesheet" href="../assets/css/style.css">
</head>
<body>
<div class="auth-shell">
    <div class="auth-card" style="text-align:center;">
        <div style="width:64px;height:64px;border-radius:50%;background:var(--gradient-brand);display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
            <i class="bi bi-check-lg" style="color:#fff;font-size:30px;"></i>
        </div>
        <h2 style="font-size:20px;">ইনস্টলেশন সম্পন্ন হয়েছে!</h2>
        <p style="color:var(--text-secondary);font-size:14px;">আপনার দোকান ব্যবস্থাপনা সিস্টেম এখন ব্যবহারের জন্য প্রস্তুত।</p>

        <div class="alert alert-warning" style="text-align:left;margin-top:18px;">
            <strong><i class="bi bi-shield-exclamation"></i> নিরাপত্তা পরামর্শ:</strong>
            নিরাপত্তার জন্য এখন <code>/install</code> ফোল্ডারটি সার্ভার থেকে মুছে ফেলুন অথবা রিনেম করে রাখুন, যাতে কেউ পুনরায় ইনস্টলার চালাতে না পারে।
        </div>

        <a href="../login.php" class="btn btn-primary btn-block" style="margin-top:8px;">লগইন করুন <i class="bi bi-arrow-left" style="transform:scaleX(-1);"></i></a>
    </div>
</div>
</body>
</html>
