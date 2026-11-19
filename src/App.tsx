/**
 * @file App.tsx
 * @description 애플리케이션의 최상위 루트 컴포넌트입니다.
 * 메인 랜딩 페이지('home')와 별도로 분리된 페이지네이션 포트폴리오 아카이브 페이지('portfolio') 간
 * 화면 전환 및 상세/문의/검색/방문자로그 모달 상태를 관리합니다.
 */
import { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import HeroSection from './components/sections/HeroSection';
import AboutSection from './components/sections/AboutSection';
import ImpactSection from './components/sections/ImpactSection';
import ProgramsSection from './components/sections/ProgramsSection';
import ProcessSection from './components/sections/ProcessSection';
import PortfolioSection from './components/sections/PortfolioSection';
import TestimonialsSection from './components/sections/TestimonialsSection';
import PartnersSection from './components/sections/PartnersSection';
import FAQSection from './components/sections/FAQSection';
import CTASection from './components/sections/CTASection';
import PortfolioPage from './components/pages/PortfolioPage';
import SearchModal from './components/modals/SearchModal';
import InquiryModal from './components/modals/InquiryModal';
import PortfolioDetailModal from './components/modals/PortfolioDetailModal';
import PrivacyPolicyModal from './components/modals/PrivacyPolicyModal';
import Modal from './components/ui/Modal';
import { trackPageView, trackEvent } from './services/analytics';
import { useScrollObserver } from './hooks/useScrollObserver';
import { PortfolioItem } from './types';
import { mockData } from './data/mockData';

/** 주소창의 ?story=ID 를 바꾼다 (새 기록을 남기지 않음). null 이면 제거. */
const setStoryParam = (id: number | null) => {
    const url = new URL(window.location.href);
    if (id === null) url.searchParams.delete('story');
    else url.searchParams.set('story', String(id));
    window.history.replaceState(window.history.state, '', url.toString());
};

type ModalType = 'search' | 'inquiry' | 'portfolioDetail' | 'privacy';

function App() {
    useScrollObserver();

    // 현재 화면 뷰 상태 ('home' 메인 페이지 | 'portfolio' 전용 페이지네이션 페이지)
    const [currentView, setCurrentView] = useState<'home' | 'portfolio'>('home');
    // 헤더에서 현재 선택된 섹션 ID (선택했을 때만 초록색 활성화)
    const [activeSection, setActiveSection] = useState<string | null>(null);
    // 포트폴리오 전용 페이지 진입 시 초기 선택 탭 ('all' | 'ots' | '기업봉사' | '단체봉사')
    const [initialPortfolioFilter, setInitialPortfolioFilter] = useState<string>('all');

    // 모달 상태 관리
    const [activeModal, setActiveModal] = useState<ModalType | null>(null);
    const [selectedPortfolioItem, setSelectedPortfolioItem] = useState<PortfolioItem | null>(null);
    // 문의 폼 '문의 내용' 기본값 (사업 안내의 나눔 키트 구성 선택 등에서 채워 넣음)
    const [inquiryPrefill, setInquiryPrefill] = useState('');

    // 화면 전환 시 가상 페이지뷰 측정 (GA4 / Postgres / 구글 시트 — 설정된 곳으로만, docs/ANALYTICS.md)
    useEffect(() => {
        if (currentView === 'home') {
            trackPageView('/', '오픈더쉐어 - 메인 홈');
        } else {
            trackPageView(
                `/portfolio?filter=${encodeURIComponent(initialPortfolioFilter)}`,
                `오픈더쉐어 - 포트폴리오 (${initialPortfolioFilter})`
            );
        }
    }, [currentView, initialPortfolioFilter]);

    // 포트폴리오 상세 모달 열기 (주소창에 ?story=ID 를 남겨 그대로 복사·공유할 수 있게 함)
    const openPortfolioDetail = (item: PortfolioItem, source = 'click') => {
        setSelectedPortfolioItem(item);
        setActiveModal('portfolioDetail');
        setStoryParam(item.id);
        trackEvent('portfolio_view', {
            item_id: String(item.id),
            item_title: item.title,
            partner: item.partner,
            category: item.category,
            source,
        });
    };

    // 공유 링크로 들어온 경우: ?story=ID → 해당 사례 상세 열기 / #섹션 → 해당 섹션으로 스크롤
    useEffect(() => {
        const storyId = Number(new URLSearchParams(window.location.search).get('story'));
        const shared = storyId ? mockData.portfolioItems.find((p) => p.id === storyId) : undefined;
        if (shared) {
            openPortfolioDetail(shared, 'shared_link');
            return;
        }
        const sectionId = decodeURIComponent(window.location.hash.slice(1));
        if (sectionId) {
            setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' }), 300);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 문의 모달 열기 (source: 어느 버튼에서 열었는지 — 전환 경로 분석용)
    const openInquiry = (source: string, prefill = '') => {
        setInquiryPrefill(prefill);
        setActiveModal('inquiry');
        trackEvent('inquiry_open', { source });
    };

    // 모달 닫기
    const closeModal = useCallback(() => {
        setActiveModal(null);
        setSelectedPortfolioItem(null);
        setStoryParam(null);
    }, []);

    // 홈으로 이동 및 특정 섹션 스크롤
    const handleNavigateHome = (sectionId?: string) => {
        setCurrentView('home');
        setActiveSection(sectionId || null);
        if (sectionId) {
            setTimeout(() => {
                const el = document.getElementById(sectionId);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth' });
                }
            }, 60);
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    // 포트폴리오 전용 페이지로 이동
    const handleNavigatePortfolio = (filter: string = 'all') => {
        setInitialPortfolioFilter(filter);
        setCurrentView('portfolio');
        setActiveSection('portfolio');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="font-sans antialiased text-slate-800 bg-white min-h-screen flex flex-col">
            <Header
                currentView={currentView}
                activeSection={activeSection}
                onNavigateHome={handleNavigateHome}
                onNavigatePortfolio={() => handleNavigatePortfolio('all')}
                onInquiryClick={() => openInquiry('header')}
                onSearchClick={() => setActiveModal('search')}
            />

            {currentView === 'home' ? (
                <main className="flex-grow">
                    <HeroSection
                        onInquiryClick={() => openInquiry('hero')}
                        onPortfolioPageClick={() => handleNavigatePortfolio('all')}
                        onPortfolioItemClick={openPortfolioDetail}
                    />
                    <AboutSection />
                    <ImpactSection />
                    <ProgramsSection
                        onInquiryClick={(summary) => openInquiry('programs', `[선택한 나눔 키트 구성] ${summary}

`)}
                    />
                    <ProcessSection />
                    <PortfolioSection
                        onPortfolioItemClick={openPortfolioDetail}
                        onViewAllClick={(filter) => handleNavigatePortfolio(filter || 'all')}
                    />
                    <TestimonialsSection />
                    <PartnersSection />
                    <FAQSection />
                    <CTASection onInquiryClick={() => openInquiry('cta')} />
                </main>
            ) : (
                <main className="flex-grow">
                    <PortfolioPage
                        initialFilter={initialPortfolioFilter}
                        onPortfolioItemClick={openPortfolioDetail}
                        onBackToHome={() => handleNavigateHome()}
                        onInquiryClick={() => openInquiry('portfolio_page')}
                    />
                </main>
            )}

            <Footer
                onNavigateHome={handleNavigateHome}
                onNavigatePortfolio={() => handleNavigatePortfolio('all')}
                onOpenPrivacy={() => setActiveModal('privacy')}
            />

            {/* 활성화된 모달 렌더링 */}
            {activeModal === 'search' && (
                <SearchModal
                    onClose={closeModal}
                    onSelectPortfolioItem={openPortfolioDetail}
                    onOpenPortfolioPage={() => handleNavigatePortfolio('all')}
                />
            )}
            {activeModal === 'inquiry' && <InquiryModal onClose={closeModal} initialMessage={inquiryPrefill} />}
            {activeModal === 'portfolioDetail' && (
                <PortfolioDetailModal
                    item={selectedPortfolioItem}
                    onClose={closeModal}
                    onSelectItem={(s) => openPortfolioDetail(s, 'similar')}
                />
            )}
            {activeModal === 'privacy' && (
                <Modal open onClose={closeModal} maxWidth="max-w-3xl" noPadding>
                    <PrivacyPolicyModal onClose={closeModal} />
                </Modal>
            )}
        </div>
    );
}

export default App;
