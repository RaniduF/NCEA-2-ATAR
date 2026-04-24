import React from 'react';

export const metadata = {
  title: 'Privacy Policy - NCEA to ATAR Calculator',
  description: 'Privacy policy for the NCEA to ATAR calculator. Learn how we handle your data.',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="space-y-8 animate-reveal-up max-w-[700px] mx-auto">
      <section className="space-y-4 pt-12 text-center border-b border-border pb-12">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-text-primary">
          Privacy <span className="text-primary italic">Policy</span>.
        </h1>
        <p className="text-sm text-text-secondary">
          Last updated: April 2026
        </p>
      </section>

      <section className="space-y-8 text-sm leading-relaxed text-text-secondary panel p-8">
        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">The short version</h2>
          <p>
            This calculator does not collect, store, or share your personal data. Your grades and results never leave your browser in a way that is saved or tracked.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">What happens when you use the calculator</h2>
          <p>
            When you enter your NCEA standards and grades and click Calculate, that information is sent to our server to perform the ATAR estimation. It is used only to compute your result and is not logged, stored in a database, or retained in any form after your result is returned.
          </p>
          <p>
            We do not know who you are, and we have no way of connecting a calculation to a specific person.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Portfolios and local storage</h2>
          <p>
            If you save a portfolio, that data is stored in your browser's local storage — on your own device, not on our servers. It is not accessible to us. Clearing your browser data or using a different device will remove it.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Cookies and tracking</h2>
          <p>
            We do not use cookies, analytics, advertising trackers, or any third-party tracking scripts. No data about your visit is shared with any third party.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-bold text-text-primary tracking-tight">Server logs</h2>
          <p>
            Our web server automatically records standard access logs (IP address, browser type, pages visited, timestamps). This is standard practice for any website and is used only to monitor server health and diagnose technical issues. These logs are not linked to any grade data you enter.
          </p>
        </div>
      </section>
    </div>
  );
}
