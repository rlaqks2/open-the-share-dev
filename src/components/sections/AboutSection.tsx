/**
 * @file AboutSection.tsx
 * @description openthe.kr의 '회사소개(About Us)' 실제 콘텐츠를 반영한 섹션입니다.
 * (상단 인사말·철학 명언·미션/비전 블록은 2026-11-24 제거, 문구는 mockData.about 에 남아 있음)
 * - 핵심가치 O.P.E.N (Opportunity, Prosperity, Equality, Neighborhood)
 * - 오픈더쉐어의 3대 가치(Value) 및 기업 담당자 맞춤 솔루션
 * - 브랜드 스토리 (구 CI 소개, openthe.kr 원본 ci.png 적용)
 */
import React from 'react';
import { mockData } from '../../data/mockData';
import ciImg from '../../assets/ci.png';

const AboutSection: React.FC = () => {
    const { about } = mockData;

    return (
        <section id="about" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 space-y-20">
                {/* 1. 핵심가치 O.P.E.N */}
                <div className="bg-[#F6FAFD] rounded-3xl p-8 md:p-12 border border-slate-200/70">
                    <div className="text-center max-w-2xl mx-auto mb-10">
                        <span className="text-xs font-extrabold text-brand-600 uppercase tracking-widest">
                            CORE VALUES
                        </span>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-1 break-keep">
                            오픈더쉐어의 4대 핵심가치 <span className="text-brand-600">O.P.E.N</span>
                        </h3>
                        <p className="text-sm text-slate-500 mt-2 break-keep">
                            다양한 분야의 문제를 발굴하고 재미있는 요소를 결합해 지속 가능한 나눔 문화를 만듭니다.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        {about.coreValues.map((cv) => (
                            <div
                                key={cv.letter}
                                className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm hover:border-brand-400 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-brand-600 text-white font-black text-2xl flex items-center justify-center mb-4 shadow-sm">
                                    {cv.letter}
                                </div>
                                <div className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                                    {cv.word}
                                </div>
                                <h4 className="text-lg font-extrabold text-slate-900 mt-0.5 mb-2 break-keep">
                                    {cv.title}
                                </h4>
                                <p className="text-xs text-slate-500 leading-relaxed break-keep">{cv.description}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. 기업 담당자의 고민 해결 & 브랜드 스토리 */}
                <div className="grid lg:grid-cols-12 gap-8 items-stretch">
                    {/* 이런 고민을 가진 파트너와 함께합니다 */}
                    <div className="lg:col-span-7 bg-white rounded-3xl p-7 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                        <div>
                            <span className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                                FOR CSR · ESG MANAGERS
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 mb-6 break-keep">
                                이런 고민을 가진 기업·단체와 함께합니다
                            </h3>
                            <div className="grid grid-cols-1 gap-3.5">
                                {about.personaNeeds.map((persona, idx) => (
                                    <div
                                        key={idx}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-4 rounded-2xl bg-slate-50 border border-slate-100 min-w-0"
                                    >
                                        <div className="flex items-start sm:items-center gap-3 min-w-0">
                                            <span className="px-2.5 py-1 rounded-lg bg-brand-600 text-white font-extrabold text-xs whitespace-nowrap shrink-0">
                                                {persona.role}
                                            </span>
                                            <p className="text-sm font-bold text-slate-700 leading-snug break-keep min-w-0">
                                                “{persona.worry}”
                                            </p>
                                        </div>
                                        <span className="self-start sm:self-auto text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-full whitespace-nowrap shrink-0">
                                            #{persona.tag}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 mt-6 break-keep">
                            * 오픈더쉐어는 사전 컨설팅부터 물품 제작, 현장 진행, 기부처 전달, 결과 보고까지 원스톱 솔루션을 제공합니다.
                        </p>
                    </div>

                    {/* 브랜드 스토리 (openthe.kr 원본 ci.png 적용) */}
                    <div className="lg:col-span-5 bg-white rounded-3xl p-7 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between min-w-0">
                        <div>
                            <span className="text-xs font-extrabold text-brand-600 uppercase tracking-wider">
                                BRAND STORY
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-1 mb-3 break-keep">
                                오픈더쉐어 브랜드 스토리
                            </h3>
                            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed mb-6 break-keep">
                                {about.ciDescription}
                            </p>
                        </div>
                        <div className="bg-[#F6FAFD] rounded-2xl p-4 sm:p-6 border border-slate-100 flex items-center justify-center overflow-hidden">
                            <img
                                src={ciImg}
                                alt="오픈더쉐어 브랜드 로고 (Open The Share)"
                                className="w-full max-w-[360px] h-auto object-contain rounded-lg"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutSection;
