"use client"

import { createPortal } from 'react-dom';
import { useAuth } from '../hooks/useAuth';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  userVoteCount: number;
  canClaim: boolean;
  onShowAboutPopup: () => void;
  onShowHowPopup: () => void;
  onShowWhyPopup: () => void;
  onShowFavoritesGallery: () => void;
  onShowLeaderboard: () => void;
  onShowPurchaseModal: () => void;
  onClaimFreeVotes: () => void;
  onDisconnect: () => void;
  isSessionActive: boolean;
  sessionStatus: string;
  formatTimeRemaining: () => string;
}

interface MenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  badge?: string | number;
}

interface MenuSectionProps {
  title: string;
  children: React.ReactNode;
}

const MenuItem = ({ icon, label, onClick, badge }: MenuItemProps) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
      padding: '16px 0',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))',
      color: 'var(--dynamic-text-color, #e5e5e5)',
      fontSize: '16px',
      fontFamily: 'var(--font-family-mono)',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.backgroundColor = 'var(--dynamic-button-hover-bg, rgba(255,255,255,0.05))';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.backgroundColor = 'transparent';
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: icon ? '12px' : '0' }}>
      {icon && (
        <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </div>
      )}
      <span>{label}</span>
    </div>
    {badge && (
      <span style={{
        background: 'var(--dynamic-accent-color, var(--color-green))',
        color: 'var(--color-white)',
        fontSize: '12px',
        padding: '2px 8px',
        borderRadius: '12px',
        fontWeight: 'bold'
      }}>
        {badge}
      </span>
    )}
  </button>
);

const MenuSection = ({ title, children }: MenuSectionProps) => (
  <div style={{ marginBottom: '32px' }}>
    <h3 style={{
      color: 'var(--dynamic-text-color-secondary, #888888)',
      fontSize: '12px',
      fontWeight: 'bold',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '16px',
      fontFamily: 'var(--font-family-mono)'
    }}>
      {title}
    </h3>
    <div>{children}</div>
  </div>
);

const StatItem = ({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <div style={{ width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </div>
      <span style={{ 
        color: 'var(--dynamic-text-color, #e5e5e5)', 
        fontSize: '14px',
        fontFamily: 'var(--font-family-mono)'
      }}>
        {label}
      </span>
    </div>
    <span style={{
      color: 'var(--dynamic-text-color, #e5e5e5)',
      fontSize: '16px',
      fontWeight: 'bold',
      fontFamily: 'var(--font-family-mono)'
    }}>
      {value}
    </span>
  </div>
);

export function MobileMenu({
  isOpen,
  onClose,
  user,
  userVoteCount,
  canClaim,
  onShowAboutPopup,
  onShowHowPopup,
  onShowWhyPopup,
  onShowFavoritesGallery,
  onShowLeaderboard,
  onShowPurchaseModal,
  onClaimFreeVotes,
  onDisconnect,
  isSessionActive,
  sessionStatus,
  formatTimeRemaining
}: MobileMenuProps) {
  if (!isOpen) return null;

  const handleMenuItemClick = (action: () => void) => {
    action();
    onClose(); // Close menu after action
  };

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000,
          backdropFilter: 'blur(4px)',
          opacity: isOpen ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
        onClick={onClose}
      />
      
      {/* Slide-out Menu */}
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '320px',
        maxWidth: '85vw',
        background: 'var(--dynamic-bg-color, #1a1a1a)',
        borderRight: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))',
        zIndex: 1001,
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        overflowY: 'auto',
        boxShadow: '4px 0 20px rgba(0,0,0,0.3)'
      }}>
        
        {/* Menu Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))',
          position: 'sticky',
          top: 0,
          background: 'var(--dynamic-bg-color, #1a1a1a)',
          zIndex: 10
        }}>
          <h2 style={{
            color: 'var(--dynamic-text-color, #e5e5e5)',
            fontSize: '18px',
            fontWeight: 'bold',
            margin: 0,
            fontFamily: 'var(--font-family-mono)'
          }}>
            MENU
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--dynamic-text-color, #e5e5e5)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--dynamic-button-hover-bg, rgba(255,255,255,0.1))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Menu Content */}
        <div style={{ padding: '24px' }}>
          
          {/* Actions Section - Moved to top */}
          <MenuSection title="Actions">
            {canClaim && (
              <MenuItem 
                label="Claim Free Licks" 
                onClick={() => handleMenuItemClick(onClaimFreeVotes)}
                badge="FREE"
              />
            )}
            <MenuItem 
              label="Add Licks" 
              onClick={() => handleMenuItemClick(onShowPurchaseModal)} 
            />
          </MenuSection>
          
          {/* Navigation Section */}
          <MenuSection title="Navigate">
            <MenuItem 
              label="Fire List" 
              onClick={() => handleMenuItemClick(onShowFavoritesGallery)} 
            />
            <MenuItem 
              label="Leaderboard" 
              onClick={() => handleMenuItemClick(onShowLeaderboard)} 
            />
            <MenuItem 
              label="About" 
              onClick={() => handleMenuItemClick(onShowAboutPopup)} 
            />
            <MenuItem 
              label="How to Play" 
              onClick={() => handleMenuItemClick(onShowHowPopup)} 
            />
            <MenuItem 
              label="Why This Matters" 
              onClick={() => handleMenuItemClick(onShowWhyPopup)} 
            />
          </MenuSection>
          
          {/* Stats Section */}
          {user && (
            <MenuSection title="Your Stats">
              <StatItem 
                icon={
                  <div style={{
                    width: '16px',
                    height: '16px',
                    backgroundColor: 'var(--dynamic-accent-color, #4ade80)',
                    borderRadius: '50%'
                  }} />
                }
                label="XP" 
                value={`${user.xp || 0}`} 
              />
              <StatItem 
                icon={
                  <div style={{
                    width: '18px',
                    height: '18px',
                    backgroundColor: 'var(--dynamic-text-color, var(--color-black))',
                    WebkitMask: 'url(/lick-icon.png) no-repeat center/contain',
                    mask: 'url(/lick-icon.png) no-repeat center/contain'
                  }} />
                } 
                label="Licks" 
                value={`${userVoteCount}`} 
              />
              <div style={{ 
                padding: '16px 0',
                borderBottom: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '12px',
                  marginBottom: '8px'
                }}>
                  <span style={{ 
                    color: 'var(--dynamic-text-color, #e5e5e5)', 
                    fontSize: '14px',
                    fontFamily: 'var(--font-family-mono)'
                  }}>
                    Prize Progress
                  </span>
                </div>
                <div style={{
                  marginLeft: '0px',
                  height: '6px',
                  background: 'var(--dynamic-border-color, rgba(255,255,255,0.1))',
                  borderRadius: '3px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    height: '100%',
                    width: `${((userVoteCount % 10) / 10) * 100}%`,
                    background: 'var(--dynamic-accent-color, var(--color-green))',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
                <div style={{
                  marginLeft: '0px',
                  marginTop: '4px',
                  fontSize: '12px',
                  color: 'var(--dynamic-text-color-secondary, #888888)',
                  fontFamily: 'var(--font-family-mono)'
                }}>
                  {userVoteCount % 10}/10 votes to next prize
                </div>
              </div>
            </MenuSection>
          )}
          
          {/* Session Status */}
          <MenuSection title="Session">
            <div style={{
              padding: '16px 0',
              borderBottom: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))'
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '12px',
                marginBottom: '8px'
              }}>
                <span style={{ 
                  color: 'var(--dynamic-text-color, #e5e5e5)', 
                  fontSize: '14px',
                  fontFamily: 'var(--font-family-mono)'
                }}>
                  Session
                </span>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: isSessionActive ? 'var(--color-green)' : '#dc2626',
                  boxShadow: isSessionActive ? '0 0 8px var(--color-green)' : '0 0 8px #dc2626'
                }} />
              </div>
              <div style={{
                marginLeft: '0px',
                fontSize: '12px',
                color: 'var(--dynamic-text-color-secondary, #888888)',
                fontFamily: 'var(--font-family-mono)'
              }}>
                {isSessionActive ? `Active (${formatTimeRemaining()})` : 'Not Active'}
              </div>
            </div>
          </MenuSection>
          
          {/* Disconnect */}
          <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: '1px solid var(--dynamic-border-color, rgba(255,255,255,0.1))' }}>
            <button
              onClick={() => handleMenuItemClick(onDisconnect)}
              style={{
                width: '100%',
                padding: '16px',
                background: 'var(--dynamic-button-bg, #333333)',
                border: '1px solid var(--dynamic-border-color, #555555)',
                borderRadius: '8px',
                color: 'var(--dynamic-text-color, #e5e5e5)',
                fontSize: '16px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-family-mono)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dynamic-button-hover-bg, #444444)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--dynamic-button-bg, #333333)';
              }}
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
