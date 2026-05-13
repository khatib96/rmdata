<?php
/**
 * Decoy landing page - no links, no mention of API.
 */
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <?php
    // مراجع رقمية (ASCII) لتفادي Mojibake إن خُزن الملف أو أعاد الخادم ترميزاً خاطئاً
    $decoyTitle = '&#1602;&#1610;&#1583; &#1575;&#1604;&#1578;&#1591;&#1608;&#1610;&#1585;';
    ?>
    <title><?php echo $decoyTitle; ?></title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%);
            font-family: 'Segoe UI', Tahoma, sans-serif;
            color: #c9a227;
            padding: 2rem;
        }
        .logo {
            max-width: 220px;
            height: auto;
            margin-bottom: 2rem;
            display: block;
        }
        h1 {
            font-size: 1.75rem;
            font-weight: 600;
            letter-spacing: 0.02em;
            color: #e8d48a;
        }
    </style>
</head>
<body>
    <img class="logo" src="/logo.png" alt="">
    <h1><?php echo $decoyTitle; ?></h1>
</body>
</html>
