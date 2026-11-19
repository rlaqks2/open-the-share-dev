/**
 * @file ProgramsSection.tsx
 * @description '핵심 사업 안내' 섹션입니다.
 * - 상단: 2대 핵심 사업 카드 (① 원데이메이킹(나눔 키트 제작) ② 기업 사회공헌 행사 컨설팅·대행)
 * - 하단 좌: 나눔 키트 프로그램 구성 옵션 (BASIC 필수 + 옵션 A~D 선택 토글 → 선택 구성을 담아 문의 모달 열기)
 * - 하단 우: 4대 핵심 사회공헌 콘텐츠 (손그림 감성 SVG 아이콘)
 * 데이터는 mockData.businessAreas / programOptions / coreContents 를 사용합니다.
 * 색상은 로고 블루(brand) · 보조 노랑(amber) 톤입니다.
 */
import React, { useState } from 'react';
import { mockData } from '../../data/mockData';

interface ProgramsSectionProps {
    /** 선택한 구성 요약(예: "BASIC (기본 포함) + 옵션 A, 옵션 C")을 담아 문의 모달을 연다 */
    onInquiryClick: (selectedSummary: string) => void;
}

type ContentIcon = (typeof mockData.coreContents)[number]['icon'];

const INK = '#0B192C';

/** 4대 콘텐츠 손그림 감성 아이콘 */
const ContentIconSvg: React.FC<{ icon: ContentIcon }> = ({ icon }) => {
    const common = { className: 'w-7 h-7', viewBox: '0 0 36 36', fill: 'none', 'aria-hidden': true } as const;
    switch (icon) {
        case 'baking':
            return (
                <svg {...common}>
                    <circle cx="18" cy="7.5" r="2.5" fill="#F43F5E" stroke={INK} strokeWidth="1.6" />
                    <path d="M18 5C19.5 3.5 21.5 3.5 22.5 4.5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M8.5 19.5C7.5 16.5 9.5 13.5 12.5 13.5C13 10.8 15.5 9.5 18 9.5C20.5 9.5 23 10.8 23.5 13.5C26.5 13.5 28.5 16.5 27.5 19.5H8.5Z" fill="#FDE68A" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M10 19.5H26L23.8 29.5C23.6 30.4 22.8 31 21.9 31H14.1C13.2 31 12.4 30.4 12.2 29.5L10 19.5Z" fill="#FDBA74" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M14.5 19.5L15.3 31M21.5 19.5L20.7 31" stroke={INK} strokeWidth="1.4" strokeLinecap="round" />
                </svg>
            );
        case 'science':
            return (
                <svg {...common}>
                    <path d="M14.5 7H21.5M16 7V13L9.8 25.5C9.1 26.9 10.1 28.5 11.7 28.5H24.3C25.9 28.5 26.9 26.9 26.2 25.5L20 13V7" fill="#E0F2FE" stroke={INK} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M11.6 22.5H24.4L26.2 26C26.7 27.1 25.9 28.5 24.6 28.5H11.4C10.1 28.5 9.3 27.1 9.8 26L11.6 22.5Z" fill="#38BDF8" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                    <circle cx="17.5" cy="18.5" r="1.3" fill="#F5B82E" />
                    <circle cx="20.5" cy="15.5" r="1" fill="#1C75BC" />
                </svg>
            );
        case 'space':
            return (
                <svg {...common}>
                    <path d="M6.5 17L18 7.5L29.5 17" stroke={INK} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9.5 15V28.5H26.5V15" fill="#FEF3C7" stroke={INK} strokeWidth="1.7" strokeLinejoin="round" />
                    <path d="M18 24.5C18 24.5 14 21.8 14 19.2C14 17.9 15 17 16.2 17C17 17 17.7 17.4 18 18C18.3 17.4 19 17 19.8 17C21 17 22 17.9 22 19.2C22 21.8 18 24.5 18 24.5Z" fill="#FB7185" stroke={INK} strokeWidth="1.4" strokeLinejoin="round" />
                </svg>
            );
        case 'esg':
            return (
                <svg {...common}>
                    <path d="M8.5 27.5C10.5 23.5 14 21.5 18 21.5C22 21.5 25.5 23.5 27.5 27.5" fill="#BAE6FD" stroke={INK} strokeWidth="1.7" strokeLinecap="round" />
                    <path d="M18 21.5V13.5" stroke={INK} strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M18 15.5C18 11.5 14 9.5 10.5 11C10.5 14.5 13.5 16.5 18 15.5Z" fill="#4ADE80" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                    <path d="M18 13.5C18 9.5 22 7.5 25.5 9C25.5 12.5 22.5 14.5 18 13.5Z" fill="#86EFAC" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
                </svg>
            );
    }
};

const ICON_BG: Record<ContentIcon, string> = {
    baking: 'bg-amber-50 border-amber-100',
    science: 'bg-sky-50 border-sky-100',
    space: 'bg-orange-50 border-orange-100',
    esg: 'bg-emerald-50 border-emerald-100',
};

const ProgramsSection: React.FC<ProgramsSectionProps> = ({ onInquiryClick }) => {
    const { businessAreas, programOptions, coreContents } = mockData;
    const basic = programOptions.find((o) => o.type === '필수');
    const extraOptions = programOptions.filter((o) => o.type !== '필수');

    const [selected, setSelected] = useState<string[]>([]);

    const toggleOption = (option: string) => {
        setSelected((prev) => (prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]));
    };

    // 화면 순서(A→D)대로 요약
    const orderedSelected = extraOptions.map((o) => o.option).filter((o) => selected.includes(o));
    const summary = `BASIC (기본 포함)${orderedSelected.length ? ` + ${orderedSelected.join(', ')}` : ''}`;

    return (
        <section id="programs" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 space-y-12 sm:space-y-16">
                {/* 섹션 헤더 */}
                <div className="text-center max-w-3xl mx-auto">
                    <span className="inline-block px-3.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-extrabold tracking-wider mb-3">
                        OUR BUSINESS
                    </span>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight break-keep">
                        핵심 사업 안내
                    </h2>
                </div>

                {/* 2대 핵심 사업 카드 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
                    {businessAreas.map((area) => {
                        const isKit = area.color === 'brand';
                        return (
                            <article
                                key={area.id}
                                className={`rounded-3xl p-6 sm:p-8 lg:p-9 border flex flex-col justify-between shadow-sm min-w-0 ${
                                    isKit ? 'bg-brand-50/60 border-brand-100' : 'bg-amber-50/50 border-amber-100'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center gap-3 mb-5">
                                        <span
                                            className={`w-8 h-8 rounded-xl text-white font-black text-sm flex items-center justify-center shrink-0 ${
                                                isKit ? 'bg-brand-600' : 'bg-amber-400'
                                            }`}
                                        >
                                            {area.number}
                                        </span>
                                        <span
                                            className={`text-xs sm:text-[13px] font-extrabold uppercase tracking-widest ${
                                                isKit ? 'text-brand-600' : 'text-amber-600'
                                            }`}
                                        >
                                            {area.label}
                                        </span>
                                    </div>
                                    <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3.5 tracking-tight break-keep">
                                        {area.title}
                                    </h3>
                                    <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed mb-7 break-keep">
                                        {area.summary}
                                    </p>
                                </div>
                                <ul className="flex flex-wrap gap-2">
                                    {area.points.map((pt) => (
                                        <li
                                            key={pt}
                                            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full bg-white border break-keep ${
                                                isKit ? 'text-brand-600 border-brand-100' : 'text-amber-700 border-amber-100'
                                            }`}
                                        >
                                            {pt}
                                        </li>
                                    ))}
                                </ul>
                            </article>
                        );
                    })}
                </div>

                {/* 하단 좌·우 2분할 */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
                    {/* 좌: 나눔 키트 프로그램 구성 옵션 */}
                    <div className="rounded-3xl bg-brand-50/60 border border-brand-100 p-6 sm:p-8 flex flex-col justify-between shadow-sm min-w-0">
                        <div>
                            <div className="mb-6">
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2 break-keep">
                                    나눔 키트 프로그램 구성 옵션
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed sm:min-h-[2.5rem] break-keep">
                                    모든 프로그램에는 BASIC 패키지가 기본 포함되며, 기업의 필요에 따라 맞춤형 옵션을 추가하실 수 있습니다.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {basic && (
                                    <div className="sm:col-span-2 rounded-2xl bg-brand-100/60 border border-brand-300 p-4 sm:p-5">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="px-3 py-0.5 rounded-full bg-brand-600 text-white text-xs font-extrabold tracking-wide">
                                                {basic.option}
                                            </span>
                                            <span className="text-xs font-bold text-brand-600">{basic.type}</span>
                                        </div>
                                        <p className="text-sm text-slate-900 leading-relaxed break-keep">
                                            <strong className="font-bold">{basic.title}</strong>{' '}
                                            <span className="text-slate-700">({basic.detail})</span>
                                        </p>
                                    </div>
                                )}

                                {extraOptions.map((opt) => {
                                    const isOn = selected.includes(opt.option);
                                    return (
                                        <button
                                            key={opt.option}
                                            type="button"
                                            aria-pressed={isOn}
                                            onClick={() => toggleOption(opt.option)}
                                            className={`text-left rounded-2xl p-4 sm:p-5 border-[1.5px] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 min-w-0 ${
                                                isOn
                                                    ? 'bg-amber-100/90 border-amber-500 ring-[3px] ring-amber-400/25'
                                                    : 'bg-amber-50/70 border-amber-300 hover:bg-amber-100/60'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-2.5">
                                                <span className="px-2.5 py-0.5 rounded-full bg-amber-400/25 border border-amber-300 text-amber-900 text-xs font-extrabold">
                                                    {opt.option}
                                                </span>
                                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                                                    {isOn && <span aria-hidden="true">✓</span>}
                                                    <span>{isOn ? '선택됨' : '선택'}</span>
                                                </span>
                                            </div>
                                            <p className="text-[13px] sm:text-sm text-slate-900 leading-relaxed break-keep">
                                                <strong className="font-bold">{opt.title}</strong>{' '}
                                                <span className="text-slate-600">({opt.detail})</span>
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 선택 요약 바 */}
                        <div className="mt-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/85 rounded-2xl px-4 py-3.5 border border-brand-100">
                            <div className="text-xs sm:text-[13px] text-slate-600 break-keep" aria-live="polite">
                                <span className="font-bold text-slate-900 block sm:inline">현재 구성:</span>
                                <span className="text-brand-600 font-semibold sm:ml-1">{summary}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onInquiryClick(summary)}
                                className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-800 text-white text-xs sm:text-[13px] font-bold transition-colors shadow-sm"
                            >
                                맞춤 견적 문의하기
                            </button>
                        </div>
                    </div>

                    {/* 우: 4대 핵심 사회공헌 콘텐츠 */}
                    <div className="rounded-3xl bg-amber-50/50 border border-amber-100 p-6 sm:p-8 shadow-sm min-w-0">
                        <div className="mb-6">
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mb-2 break-keep">
                                4대 핵심 사회공헌 콘텐츠
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed sm:min-h-[2.5rem] break-keep">
                                기업의 ESG 목표와 임직원 참여 형태에 맞춰 선택할 수 있는 대표 사회공헌 테마입니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {coreContents.map((c) => (
                                <div
                                    key={c.id}
                                    className="rounded-2xl p-4 sm:p-5 bg-white border-[1.5px] border-amber-100 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-md min-w-0"
                                >
                                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-3 ${ICON_BG[c.icon]}`}>
                                        <ContentIconSvg icon={c.icon} />
                                    </div>
                                    <span className="inline-block px-2.5 py-0.5 rounded-md bg-amber-100/80 text-amber-800 text-[11px] font-bold mb-1.5 break-keep">
                                        {c.subtitle}
                                    </span>
                                    <h4 className="text-base font-extrabold text-slate-900 mb-1.5 break-keep">{c.title}</h4>
                                    <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed break-keep">
                                        {c.description}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ProgramsSection;
