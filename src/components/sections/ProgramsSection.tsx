/**
 * @file ProgramsSection.tsx
 * @description 오픈더쉐어의 2대 핵심 사업 유형을 구분해 보여주는 섹션입니다.
 * ① 나눔 키트 제작(핸즈온 프로그램) — 온앤온(대면)·온팅(비대면) 브랜드 + 4대 핵심 사회공헌 콘텐츠 + 옵션 구성
 * ② 기업 행사·컨설팅 대행 — 기획·현장 운영·결과 보고 대행
 * 색상은 로고 블루 톤(메인 brand · 보조 navy)으로 통일합니다.
 */
import React from 'react';
import { mockData } from '../../data/mockData';
import onnonIcon from '../../assets/b_onnon.png';
import ontingIcon from '../../assets/b_onting.png';

const ProgramsSection: React.FC = () => {
    const { businessAreas, flagshipBrands, programs, programOptions } = mockData;
    const [kitArea, eventArea] = businessAreas;

    return (
        <section id="programs" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 space-y-16">
                {/* 섹션 헤더 */}
                <div className="text-center max-w-3xl mx-auto">
                    <span className="inline-block px-3.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-extrabold mb-3">
                        OUR BUSINESS · 2대 핵심 사업
                    </span>
                    <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4 break-keep">
                        오픈더쉐어가 하는 일, 두 가지로 정리했습니다
                    </h2>
                    <p className="text-slate-600 text-base break-keep">
                        직접 만들어 나누는 <strong className="text-brand-700">나눔 키트 제작(핸즈온 프로그램)</strong>과
                        사회공헌 행사를 대신 기획·운영하는 <strong className="text-navy-600">기업 행사·컨설팅 대행</strong>으로
                        기업과 단체의 사회공헌을 돕습니다.
                    </p>
                </div>

                {/* 2대 사업 한눈에 보기 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {businessAreas.map((area) => {
                        const isKit = area.color === 'brand';
                        return (
                            <a
                                key={area.id}
                                href={`#business-${area.id}`}
                                className={`group rounded-3xl p-7 sm:p-8 border-2 min-w-0 transition-all hover:shadow-md ${
                                    isKit
                                        ? 'bg-brand-50/60 border-brand-200 hover:border-brand-400'
                                        : 'bg-navy-50/60 border-navy-200 hover:border-navy-400'
                                }`}
                            >
                                <div className="flex items-center gap-3 mb-4">
                                    <span
                                        className={`w-12 h-12 rounded-2xl text-white font-black text-lg flex items-center justify-center shrink-0 ${
                                            isKit ? 'bg-brand-600' : 'bg-navy-500'
                                        }`}
                                    >
                                        {area.number}
                                    </span>
                                    <span
                                        className={`text-xs font-extrabold uppercase tracking-widest ${
                                            isKit ? 'text-brand-700' : 'text-navy-700'
                                        }`}
                                    >
                                        {area.label}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-2 break-keep">
                                    {area.title}
                                </h3>
                                <p className="text-sm text-slate-600 leading-relaxed mb-5 break-keep">{area.summary}</p>
                                <ul className="flex flex-wrap gap-2">
                                    {area.points.map((pt) => (
                                        <li
                                            key={pt}
                                            className={`text-xs font-bold px-3 py-1 rounded-full bg-white border break-keep ${
                                                isKit ? 'text-brand-700 border-brand-200' : 'text-navy-700 border-navy-200'
                                            }`}
                                        >
                                            {pt}
                                        </li>
                                    ))}
                                </ul>
                            </a>
                        );
                    })}
                </div>

                {/* ① 나눔 키트 제작 (핸즈온 프로그램) */}
                <div id={`business-${kitArea.id}`} className="scroll-mt-24 space-y-12">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-brand-600 text-white font-black flex items-center justify-center shrink-0">
                            {kitArea.number}
                        </span>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 break-keep">{kitArea.title}</h3>
                    </div>

                    {/* 1-1. 운영 방식 2종 (온앤온 대면 / 온팅 비대면) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {flagshipBrands.map((brand, idx) => {
                            const isOnAndOn = idx === 0;
                            const brandIcon = isOnAndOn ? onnonIcon : ontingIcon;
                            return (
                                <div
                                    key={brand.id}
                                    className={`rounded-3xl p-7 sm:p-9 border-2 flex flex-col justify-between min-w-0 ${
                                        isOnAndOn
                                            ? 'bg-gradient-to-br from-brand-50/70 to-white border-brand-200'
                                            : 'bg-gradient-to-br from-navy-50/70 to-white border-navy-200'
                                    }`}
                                >
                                    <div>
                                        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                                            <span
                                                className={`px-3.5 py-1 rounded-full text-xs font-extrabold whitespace-nowrap text-white ${
                                                    isOnAndOn ? 'bg-brand-600' : 'bg-navy-500'
                                                }`}
                                            >
                                                {brand.badge}
                                            </span>
                                            <img
                                                src={brandIcon}
                                                alt={`${brand.name} 공식 아이콘`}
                                                className="w-14 h-14 object-contain shrink-0"
                                            />
                                        </div>

                                        <h4 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 break-keep">
                                            {brand.name}
                                        </h4>
                                        <p
                                            className={`text-sm font-extrabold mb-4 break-keep ${
                                                isOnAndOn ? 'text-brand-700' : 'text-navy-700'
                                            }`}
                                        >
                                            “{brand.meaning}”
                                        </p>
                                        <p className="text-sm text-slate-600 leading-relaxed mb-6 break-keep">
                                            {brand.description}
                                        </p>
                                    </div>

                                    {/* 강점 포인트 */}
                                    <div className="pt-5 border-t border-slate-200/70">
                                        <h5 className="text-xs font-extrabold text-slate-500 mb-2.5">
                                            프로그램 핵심 강점
                                        </h5>
                                        <ul className="space-y-2">
                                            {brand.strengths.map((str, i) => (
                                                <li key={i} className="text-xs sm:text-sm text-slate-600 flex items-start gap-2 break-keep">
                                                    <span
                                                        className={`font-bold shrink-0 mt-0.5 ${
                                                            isOnAndOn ? 'text-brand-600' : 'text-navy-600'
                                                        }`}
                                                    >
                                                        ✓
                                                    </span>
                                                    <span>{str}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* 1-2. 핸즈온 프로그램으로 만나는 4대 핵심 콘텐츠 */}
                    <div>
                        <div className="text-center mb-8">
                            <h4 className="text-xl md:text-2xl font-black text-slate-900 break-keep">
                                핸즈온 프로그램으로 만나는 4대 핵심 사회공헌 콘텐츠
                            </h4>
                            <p className="text-sm text-slate-500 mt-2 break-keep">
                                온앤온·온팅 어느 방식이든 아래 주제 중에서 골라 프로그램을 구성할 수 있습니다.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {programs.map((program, idx) => {
                                const isPrimary = idx % 2 === 0;
                                return (
                                    <div
                                        key={program.id}
                                        className={`p-7 rounded-3xl border transition-all hover:shadow-md min-w-0 ${
                                            isPrimary
                                                ? 'bg-brand-50/50 border-brand-100 hover:border-brand-400'
                                                : 'bg-navy-50/50 border-navy-100 hover:border-navy-400'
                                        }`}
                                    >
                                        <div className="text-4xl mb-4">{program.icon}</div>
                                        <span
                                            className={`inline-block text-[11px] font-extrabold px-2.5 py-0.5 rounded-md mb-2 whitespace-nowrap ${
                                                isPrimary ? 'text-brand-700 bg-brand-100/80' : 'text-navy-700 bg-navy-100/80'
                                            }`}
                                        >
                                            {program.subtitle}
                                        </span>
                                        <h5 className="text-lg font-extrabold text-slate-900 mb-2 break-keep">
                                            {program.title}
                                        </h5>
                                        <p className="text-xs text-slate-600 leading-relaxed break-keep">
                                            {program.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 1-3. 프로그램 옵션 구성 (openthe.kr/yc/sub/sub2_1.php 실 데이터) */}
                    <div className="bg-brand-900 text-white rounded-3xl p-7 sm:p-10 md:p-12">
                        <div className="max-w-2xl mb-8">
                            <span className="text-xs font-extrabold text-navy-300 uppercase tracking-widest">
                                PROGRAM OPTIONS
                            </span>
                            <h4 className="text-2xl md:text-3xl font-black mt-1 mb-2 break-keep">
                                나눔 키트 프로그램 기본 제공 및 선택 옵션 안내
                            </h4>
                            <p className="text-sm text-brand-100 break-keep">
                                모든 프로그램에는 BASIC 패키지가 기본 포함되며, 기업의 필요에 따라 맞춤형 옵션을 추가하실 수 있습니다.
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                            {programOptions.map((opt) => {
                                const isBasic = opt.option === 'BASIC';
                                return (
                                    <div
                                        key={opt.option}
                                        className={`rounded-2xl p-6 border min-w-0 ${
                                            isBasic ? 'bg-brand-600/30 border-brand-400' : 'bg-white/5 border-white/15'
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <span
                                                className={`px-2.5 py-1 rounded-md text-xs font-extrabold whitespace-nowrap ${
                                                    isBasic ? 'bg-brand-500 text-white' : 'bg-white text-brand-800'
                                                }`}
                                            >
                                                {opt.option}
                                            </span>
                                            <span className="text-xs font-bold text-brand-200 whitespace-nowrap">{opt.type}</span>
                                        </div>
                                        <p className="text-sm text-brand-50 leading-relaxed font-medium break-keep">
                                            {opt.content}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* ② 기업 행사 · 컨설팅 대행 */}
                <div
                    id={`business-${eventArea.id}`}
                    className="scroll-mt-24 rounded-3xl p-7 sm:p-10 md:p-12 bg-gradient-to-br from-navy-50 to-white border-2 border-navy-200"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <span className="w-10 h-10 rounded-xl bg-navy-500 text-white font-black flex items-center justify-center shrink-0">
                            {eventArea.number}
                        </span>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 break-keep">{eventArea.title}</h3>
                    </div>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl mb-8 break-keep">
                        {eventArea.summary}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                        {eventArea.points.map((pt, i) => (
                            <div key={pt} className="bg-white rounded-2xl p-5 border border-navy-100 shadow-sm min-w-0">
                                <span className="text-xs font-extrabold text-navy-600">0{i + 1}</span>
                                <p className="text-sm sm:text-base font-extrabold text-slate-900 mt-1 break-keep">{pt}</p>
                            </div>
                        ))}
                    </div>
                    <a
                        href="#process"
                        className="inline-flex items-center gap-2 text-sm font-extrabold text-navy-700 hover:text-navy-800 break-keep"
                    >
                        <span>진행 프로세스 자세히 보기</span>
                        <span aria-hidden="true">&darr;</span>
                    </a>
                </div>
            </div>
        </section>
    );
};

export default ProgramsSection;
