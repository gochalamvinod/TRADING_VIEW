import sys

# 1. Append authentic TradingView Pine Editor styles to pine_editor.css
tv_styles = '''
/* =========================================================================
 * Authentic TradingView 1:1 Pine Editor Styling (Images 1-5)
 * ========================================================================= */
#pine_editor_dock {
  background: #ffffff !important;
  color: #131722 !important;
  border-left: 1px solid #e0e3eb !important;
  font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif !important;
  box-shadow: -2px 0 12px rgba(0, 0, 0, 0.08);
}

.pine-win-header {
  height: 32px;
  min-height: 32px;
  background: #ffffff;
  border-bottom: 1px solid #e0e3eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  box-sizing: border-box;
  user-select: none;
}

.pine-win-header-left {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #131722;
  font-size: 13px;
  font-weight: 600;
}

.pine-win-dock-icon {
  color: #787b86;
}

.pine-win-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pine-win-btn {
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: #787b86;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.pine-win-btn:hover {
  background: #f0f3fa;
  color: #131722;
}

.pine-win-btn.close:hover {
  background: #fde8e8;
  color: #f23645;
}

.pine-toolbar-v2 {
  height: 38px;
  min-height: 38px;
  background: #ffffff;
  border-bottom: 1px solid #e0e3eb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  gap: 8px;
  box-sizing: border-box;
  user-select: none;
}

.pine-toolbar-v2-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.pine-toolbar-v2-right {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.pine-script-dropdown-btn-v2 {
  background: #ffffff;
  border: 1px solid #d1d4dc;
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #131722;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  max-width: 280px;
}

.pine-script-dropdown-btn-v2:hover {
  background: #f0f3fa;
}

.pine-icon-sine {
  font-size: 14px;
  color: #787b86;
  font-weight: bold;
}

.pine-more-dots {
  color: #787b86;
  margin: 0 2px;
}

.pine-caret-v2 {
  width: 8px;
  height: 5px;
  color: #787b86;
  margin-left: 2px;
}

.pine-btn-action-v2 {
  background: #ffffff;
  border: 1px solid #d1d4dc;
  border-radius: 4px;
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 500;
  color: #131722;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s;
  white-space: nowrap;
}

.pine-btn-action-v2:hover {
  background: #f0f3fa;
}

.pine-btn-icon-v2 {
  background: #ffffff;
  border: 1px solid #d1d4dc;
  border-radius: 4px;
  padding: 5px 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #131722;
  cursor: pointer;
  position: relative;
  transition: background 0.12s;
}

.pine-btn-icon-v2:hover {
  background: #f0f3fa;
}

.pine-red-notification-dot {
  width: 6px;
  height: 6px;
  background: #f23645;
  border-radius: 50%;
  position: absolute;
  top: 3px;
  right: 3px;
  pointer-events: none;
}

.pine-red-notification-dot.inline {
  position: static;
  display: inline-block;
  margin-left: 4px;
  margin-right: 2px;
  vertical-align: middle;
}

.pine-header-dropdown-menu-v2,
.pine-more-dropdown-menu-v2 {
  position: absolute;
  top: calc(100% + 4px);
  background: #ffffff;
  border: 1px solid #e0e3eb;
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  z-index: 10000;
  display: none;
  padding: 6px 0;
  min-width: 250px;
  box-sizing: border-box;
}

.pine-header-dropdown-menu-v2.show,
.pine-more-dropdown-menu-v2.show {
  display: block;
}

.pine-more-dropdown-menu-v2 {
  right: 0;
  min-width: 220px;
}

.pine-menu-item-v2 {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 14px;
  font-size: 13px;
  color: #131722;
  cursor: pointer;
  user-select: none;
  transition: background 0.1s;
}

.pine-menu-item-v2:hover:not(.disabled) {
  background: #f0f3fa;
}

.pine-menu-item-v2.disabled {
  color: #b2b5be;
  cursor: not-allowed;
}

.pine-menu-item-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pine-menu-hotkey {
  font-size: 11px;
  color: #787b86;
}

.pine-menu-divider-v2 {
  height: 1px;
  background: #e0e3eb;
  margin: 4px 0;
}

.pine-menu-group-header-v2 {
  font-size: 11px;
  font-weight: 600;
  color: #787b86;
  text-transform: uppercase;
  padding: 6px 14px 4px;
  letter-spacing: 0.5px;
}

.pine-recent-item-v2 {
  padding: 7px 14px;
  font-size: 13px;
  color: #131722;
  cursor: pointer;
  margin: 2px 6px;
  border-radius: 4px;
  transition: background 0.1s, color 0.1s;
}

.pine-recent-item-v2:hover {
  background: #f0f3fa;
}

.pine-recent-item-v2.active {
  background: #2a2e39;
  color: #ffffff;
  font-weight: 500;
}

.pine-toggle-switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 18px;
}

.pine-toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.pine-toggle-knob {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #b2b5be;
  transition: 0.2s;
  border-radius: 18px;
}

.pine-toggle-knob:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

.pine-toggle-switch input:checked + .pine-toggle-knob {
  background-color: #2962ff;
}

.pine-toggle-switch input:checked + .pine-toggle-knob:before {
  transform: translateX(16px);
}

.pine-help-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #e0e3eb;
  color: #787b86;
  font-size: 10px;
  font-weight: bold;
  margin-left: 4px;
  cursor: help;
}

.pine-readonly-banner {
  background: #fff8e1;
  border-bottom: 1px solid #ffe082;
  padding: 8px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #b45309;
  font-weight: 500;
  box-sizing: border-box;
}

.pine-readonly-icon {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.pine-readonly-text {
  flex: 1;
}

.pine-readonly-copy-link {
  color: #2962ff;
  text-decoration: none;
  font-weight: 600;
  cursor: pointer;
}

.pine-readonly-copy-link:hover {
  text-decoration: underline;
}

.pine-workspace {
  background: #ffffff !important;
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.pine-gutter {
  background: #ffffff !important;
  border-right: 1px solid #f0f3fa !important;
  color: #787b86 !important;
  font-size: 12px;
  line-height: 20px;
  font-family: Consolas, Monaco, "Courier New", monospace;
}

.pine-editor-container {
  background: #ffffff !important;
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

.pine-code-textarea {
  background: transparent !important;
  color: #131722 !important;
  caret-color: #131722 !important;
  font-family: Consolas, Monaco, "Courier New", monospace !important;
  font-size: 13px !important;
  line-height: 20px !important;
  padding-right: 48px !important;
}

.pine-minimap-strip {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 42px;
  background: #fafbfc;
  border-left: 1px solid #f0f3fa;
  pointer-events: none;
  opacity: 0.8;
}

.pine-console-drawer-v2 {
  background: #ffffff;
  border-top: 1px solid #e0e3eb;
  max-height: 110px;
  min-height: 48px;
  overflow-y: auto;
  padding: 6px 12px;
  box-sizing: border-box;
}

.pine-console-v2-entry {
  font-family: Consolas, Monaco, "Courier New", monospace;
  font-size: 12px;
  line-height: 20px;
  color: #787b86;
}

.pine-bottom-statusbar-v2 {
  height: 28px;
  min-height: 28px;
  background: #ffffff;
  border-top: 1px solid #e0e3eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  color: #131722;
  box-sizing: border-box;
  user-select: none;
}

.pine-status-v2-left {
  display: flex;
  align-items: center;
}

.pine-console-toggle-btn-v2 {
  background: #ffffff;
  border: 1px solid #d1d4dc;
  border-radius: 3px;
  padding: 2px 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #787b86;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.pine-console-toggle-btn-v2:hover,
.pine-console-toggle-btn-v2.active {
  background: #f0f3fa;
  color: #131722;
}

.pine-status-v2-right {
  display: flex;
  align-items: center;
  gap: 16px;
  color: #131722;
}

.pine-status-item-v2 {
  font-size: 12px;
  color: #131722;
}
'''

with open('pine_editor.css', 'a', encoding='utf-8') as f:
    f.write('\n' + tv_styles)

print("Appended authentic TradingView Pine Editor styles to pine_editor.css")
