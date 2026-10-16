'use client';

import { useState } from 'react';
import './donation.css';

const MOMO_URL = 'https://me.momo.vn/zbfAIwTbIvuOINC7';

export default function DonationSupport() {
  const [showMomoQr, setShowMomoQr] = useState(false);
  const [showBankQr, setShowBankQr] = useState(false);

  return (
    <section className="donationSection" aria-labelledby="donation-title">
      <div className="donationIntro">
        <div className="coffeeIcon" aria-hidden="true"><span>☕</span></div>
        <div>
          <div className="donationEyebrow">SUPPORT THIS PROJECT</div>
          <h2 id="donation-title">Buy me a Coffee</h2>
          <p>Nếu công cụ hữu ích với bạn, hãy ủng hộ để giúp duy trì và phát triển nhé 😊</p>
        </div>
      </div>

      <div className="donationCards">
        <div className="donationCard">
          <div className="donationCardHead">
            <span className="paymentDot momoDot" aria-hidden="true">M</span>
            <div><strong>MoMo · VietQR</strong><small>Ủng hộ qua MoMo hoặc ứng dụng ngân hàng</small></div>
          </div>
          <button type="button" className="qrToggleButton momoToggle" aria-expanded={showMomoQr} onClick={() => setShowMomoQr(v => !v)}>
            {showMomoQr ? 'Ẩn mã QR ▲' : 'Hiện mã QR ▼'}
          </button>
          {showMomoQr && (
            <>
              <a className="donationQrLink" href={MOMO_URL} target="_blank" rel="noopener noreferrer" aria-label="Mở liên kết MoMo">
                <img src="/momo-vietqr.png" alt="Mã QR MoMo VietQR" className="donationQr momoQr" />
              </a>
              <div className="qrCaption">Quét mã bằng ứng dụng MoMo hoặc ngân hàng</div>
            </>
          )}
          <a className="paymentLink momoPaymentLink" href={MOMO_URL} target="_blank" rel="noopener noreferrer">Mở MoMo để ủng hộ ↗</a>
        </div>

        <div className="donationCard">
          <div className="donationCardHead">
            <span className="paymentDot bankDot" aria-hidden="true">T</span>
            <div><strong>Techcombank · VietQR</strong><small>Ủng hộ qua chuyển khoản ngân hàng</small></div>
          </div>
          <button type="button" className="qrToggleButton bankToggle" aria-expanded={showBankQr} onClick={() => setShowBankQr(v => !v)}>
            {showBankQr ? 'Ẩn mã VietQR ▲' : 'Hiện mã VietQR ▼'}
          </button>
          {showBankQr && (
            <>
              <a className="donationQrLink" href="/techcombank-qr.png" target="_blank" rel="noopener noreferrer" aria-label="Mở mã QR Techcombank kích thước lớn">
                <img src="/techcombank-qr.png" alt="Mã VietQR Techcombank" className="donationQr bankQr" />
              </a>
              <div className="qrCaption">Quét mã VietQR bằng ứng dụng ngân hàng</div>
            </>
          )}
          <a className="paymentLink bankPaymentLink" href="/techcombank-qr.png" target="_blank" rel="noopener noreferrer">Mở QR chuyển khoản ↗</a>
        </div>
      </div>
    </section>
  );
}
