import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const Layout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B0F19] text-slate-900 dark:text-slate-100 flex flex-col antialiased transition-colors duration-200 w-full max-w-full min-w-0">
      {/* Sidebar for Desktop & Mobile Overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area: Offset by sidebar width on desktop */}
      <div className="flex-1 flex flex-col lg:pl-[270px] transition-all duration-300 min-h-screen w-full max-w-full min-w-0">
        {/* Top Header */}
        <Header onMenuClick={() => setSidebarOpen(true)} />

        {/* Dynamic Route View: Responsive Full Width Container */}
        <main id="main-content" className="flex-1 w-full max-w-[1700px] min-w-0 mx-auto p-4 sm:p-6 md:p-8 lg:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
