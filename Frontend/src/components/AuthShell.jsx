import React from "react";

const AuthShell = ({ title, subtitle, children }) => {
  return (
    <div className="min-h-[100dvh] bg-[#f6f7fb] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100dvh-5rem)] max-w-5xl items-center justify-center">
        <div className="relative w-full">
          <div className="pointer-events-none absolute inset-0 -z-10 blur-3xl">
            <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-300/35" />
            <div className="absolute -right-20 -top-10 h-72 w-72 rounded-full bg-orange-300/25" />
            <div className="absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-sky-300/20" />
          </div>

          <div className="grid gap-8 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-xl backdrop-blur-xl md:grid-cols-[1.1fr,0.9fr] md:p-10">
            <div className="flex flex-col justify-between border-b border-slate-200 pb-6 md:border-b-0 md:border-r md:pb-0 md:pr-8">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  TaskFlow
                </div>

                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">{title}</h1>
                  <p className="mt-2 text-sm text-slate-600">{subtitle}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="w-full max-w-sm">{children}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
