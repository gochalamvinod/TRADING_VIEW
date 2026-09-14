import sys

with open('pine_editor_ide.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# 1. Update updateCursor to sync #pine_status_coords
old_cursor = '''    cursorPos.textContent = `Line ${lineNum}, Col ${colNum}`;'''
new_cursor = '''    cursorPos.textContent = `Line ${lineNum}, Col ${colNum}`;
    const statusCoords = document.getElementById('pine_status_coords');
    if (statusCoords) statusCoords.textContent = `Line ${lineNum}, Col ${colNum}`;'''

assert old_cursor in content, "old_cursor not found"
content = content.replace(old_cursor, new_cursor, 1)

# 2. Update dock.innerHTML in mountPineEditorIDE
old_dock_html_start = '''    dock.innerHTML = `
      <!-- Horizontal Drag Resize Handle -->'''
old_dock_html_end = '''      <!-- Status Bar -->
      <div class="pine-statusbar">
        <div class="pine-statusbar-item">
          <span id="pine_cursor_pos">Line 1, Col 1</span>
        </div>
        <div class="pine-statusbar-item">
          <span id="pine_version_display">PineScript v6</span>
          <span style="color: #363a45;">|</span>
          <span>UTF-8</span>
        </div>
      </div>
    `;'''

new_dock_html = '''    dock.innerHTML = `
      <!-- Horizontal Drag Resize Handle -->
      <div id="pine_resize_handle" title="Drag to resize Pine Editor"></div>

      <!-- 1. Window Titlebar (Image 1 top bar) -->
      <div class="pine-win-header">
        <div class="pine-win-header-left">
          <svg class="pine-win-dock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <polyline points="9 9 4 4 4 9"/>
            <line x1="4" y1="4" x2="10" y2="10"/>
          </svg>
          <span class="pine-win-title">Pine Editor</span>
        </div>
        <div class="pine-win-header-right">
          <button type="button" class="pine-win-btn" id="pine_win_minimize" title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"/></svg>
          </button>
          <button type="button" class="pine-win-btn" id="pine_win_maximize" title="Maximize">
            <svg id="pine_max_icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1.5"/></svg>
          </button>
          <button type="button" class="pine-win-btn close" id="pine_win_close" title="Close Pine Editor">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      </div>

      <!-- 2. Action Toolbar (Image 1 & 2) -->
      <div class="pine-toolbar-v2">
        <!-- Left Cluster -->
        <div class="pine-toolbar-v2-left">
          <!-- Script Selector Dropdown (Image 2) -->
          <div class="pine-script-dropdown-wrapper" id="pine_dropdown_wrapper" style="position: relative;">
            <button type="button" class="pine-script-dropdown-btn-v2" id="pine_script_dropdown_trigger" title="Script options and templates">
              <span class="pine-icon-sine">~</span>
              <span class="pine-script-title-text" id="pine_script_title_display">${escapeHtml(_currentScript.name)}</span>
              <span class="pine-more-dots">...</span>
              <svg class="pine-caret-v2" viewBox="0 0 10 6">
                <path d="M0 0l5 5 5-5z" fill="currentColor"/>
              </svg>
            </button>
            <div class="pine-header-dropdown-menu-v2" id="pine_dropdown_menu">
              <div class="pine-menu-item-v2 ${(_currentScript.isReadOnly !== false) ? 'disabled' : ''}" id="pine_menu_save_script">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span>Save script</span>
                </div>
                <span class="pine-menu-hotkey">Ctrl + S</span>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_make_copy">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Make a copy...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2 ${(_currentScript.isReadOnly !== false) ? 'disabled' : ''}" id="pine_menu_rename">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                  <span>Rename...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_version_history">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 14 14"/>
                  </svg>
                  <span>Version history...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_toggle_dock_position">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <polyline points="9 19 12 22 15 19"/>
                  </svg>
                  <span id="pine_dock_pos_text">${_dockPosition === 'bottom' ? 'Move script to side' : 'Move script to bottom'}</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_create_new">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>Create new</span>
                </div>
                <span class="pine-menu-arrow">&rsaquo;</span>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">RECENTLY USED</div>
              <div id="pine_dropdown_recent_list" class="pine-recent-list-v2"></div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_open_script">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>Open script...</span>
                </div>
                <span class="pine-menu-hotkey">Ctrl + O</span>
              </div>
            </div>
          </div>

          <!-- Add to Chart Button (Outline Play Button) -->
          <button id="pine_add_to_chart_btn" class="pine-btn-action-v2" title="Add indicator to chart (Ctrl + Enter)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Add to chart</span>
          </button>
        </div>

        <!-- Right Cluster -->
        <div class="pine-toolbar-v2-right">
          <!-- Publish Script Button -->
          <button id="pine_publish_btn" class="pine-btn-action-v2" title="Publish script to community">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span>Publish script</span>
          </button>

          <!-- More Actions Button (••• with red dot) -->
          <div class="pine-more-dropdown-wrapper" id="pine_more_wrapper" style="position: relative;">
            <button id="pine_more_btn" class="pine-btn-icon-v2" title="More options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="19" cy="12" r="2"/>
              </svg>
              <span class="pine-red-notification-dot"></span>
            </button>
            <div class="pine-more-dropdown-menu-v2" id="pine_more_menu">
              <div class="pine-menu-item-v2" id="pine_menu_editor_settings">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Editor settings...</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">OPEN EDITOR</div>
              <div class="pine-menu-item-v2" id="pine_menu_open_new_window">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="12" y1="13" x2="12" y2="17"/>
                    <line x1="10" y1="15" x2="14" y2="15"/>
                  </svg>
                  <span>New window</span>
                </div>
              </div>
              <div class="pine-menu-item-v2" id="pine_menu_open_new_tab">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span>New tab</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">DEVELOPER TOOLS</div>
              <div class="pine-menu-item-v2 pine-item-switch-row" id="pine_menu_profiler_row">
                <div class="pine-menu-item-left">
                  <span>Profiler mode</span>
                  <span class="pine-help-badge" title="Profile script execution time">?</span>
                </div>
                <label class="pine-toggle-switch">
                  <input type="checkbox" id="pine_profiler_switch">
                  <span class="pine-toggle-knob"></span>
                </label>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_pine_logs">
                <div class="pine-menu-item-left">
                  <span>Pine logs</span>
                  <span class="pine-help-badge" title="View runtime script logs">?</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_release_notes">
                <div class="pine-menu-item-left">
                  <span>Release notes</span>
                  <span class="pine-red-notification-dot inline"></span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_help">
                <div class="pine-menu-item-left">
                  <span>Help</span>
                </div>
                <span class="pine-menu-arrow">&rsaquo;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Read-Only Warning Banner (Image 1) -->
      <div class="pine-readonly-banner" id="pine_readonly_banner" style="display: ${_currentScript.isReadOnly !== false ? 'flex' : 'none'};">
        <div class="pine-readonly-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#e65100">
            <circle cx="12" cy="12" r="10" fill="#e65100"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1.2" fill="#ffffff"/>
          </svg>
        </div>
        <div class="pine-readonly-text">
          This script is read-only. To edit its code you can <a href="#" class="pine-readonly-copy-link" id="pine_banner_copy_btn">make a copy.</a>
        </div>
      </div>

      <!-- 4. Editor Workspace & Minimap -->
      <div id="pine_editor_view" class="pine-workspace">
        <div id="pine_gutter" class="pine-gutter" data-name="pine_editor_gutter">1</div>
        <div class="pine-editor-container">
          <pre id="pine_syntax_backdrop" class="pine-syntax-backdrop" aria-hidden="true"><code id="pine_syntax_code" class="pine-syntax-code"></code></pre>
          <textarea id="pine_code_input" class="pine-code-textarea" name="pine_editor_textarea" data-name="pine_editor_textarea" spellcheck="false" placeholder="// Enter Pine Script v5/v6 code...">${escapeHtml(_currentScript.code)}</textarea>
          
          <!-- Minimap overview (Image 1 right strip) -->
          <div class="pine-minimap-strip" id="pine_minimap_strip">
            <div class="pine-minimap-slider" id="pine_minimap_slider"></div>
          </div>

          <!-- Floating Autocomplete / IntelliSense Popover -->
          <div id="pine_autocomplete_popover">
            <div class="pine-ac-header">
              <span>PINE INTELLISENSE</span>
              <span style="font-size: 10px; color: #787b86;">&uarr;&darr; Navigate &bull; Tab/Enter Insert &bull; Esc</span>
            </div>
            <div id="pine_ac_list" class="pine-ac-list"></div>
          </div>

          <!-- Parameter Hint Popover -->
          <div id="pine_param_hint"></div>
        </div>
      </div>

      <!-- 5. Collapsible Console Drawer (Image 5) -->
      <div id="pine_console_drawer_v2" class="pine-console-drawer-v2" style="display: none;">
        <div id="pine_console_v2_body" class="pine-console-v2-body">
          <div class="pine-console-v2-entry">${formatLogTime()} "${escapeHtml(_currentScript.name)}" opened</div>
        </div>
      </div>

      <!-- 6. Status Bar (Image 4) -->
      <div class="pine-bottom-statusbar-v2">
        <div class="pine-status-v2-left">
          <button type="button" class="pine-console-toggle-btn-v2" id="pine_console_toggle_btn" title="Toggle Pine Console">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </button>
        </div>
        <div class="pine-status-v2-right">
          <span id="pine_status_rev_date" class="pine-status-item-v2">4 &middot; Aug 3, 18:31</span>
          <span id="pine_status_coords" class="pine-status-item-v2">Line 14, Col 35</span>
          <span id="pine_status_version" class="pine-status-item-v2">Pine Script&reg; v6</span>
        </div>
      </div>
    `;'''

# Find boundaries of old dock innerHTML
start_pos = content.find(old_dock_html_start)
end_pos = content.find(old_dock_html_end)
assert start_pos != -1, "old_dock_html_start not found"
assert end_pos != -1, "old_dock_html_end not found"

content = content[:start_pos] + new_dock_html + content[end_pos + len(old_dock_html_end):]

# 3. Add helper functions: formatLogTime, makeCopyOfCurrentScript, logConsoleV2, toggleConsoleDrawerV2
helpers = '''
  function formatLogTime() {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }

  function logConsoleV2(msg) {
    const body = document.getElementById('pine_console_v2_body');
    if (body) {
      const div = document.createElement('div');
      div.className = 'pine-console-v2-entry';
      div.textContent = msg;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }
  }

  function toggleConsoleDrawerV2() {
    const drawer = document.getElementById('pine_console_drawer_v2');
    const btn = document.getElementById('pine_console_toggle_btn');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none' || !drawer.style.display;
    drawer.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      if (isHidden) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  function makeCopyOfCurrentScript() {
    const code = document.getElementById('pine_code_input')?.value || _currentScript.code;
    const baseName = _currentScript.name.replace(/\\s*\\((Copy|\\d+)\\)$/, '');
    const copyName = `${baseName} (Copy)`;
    _currentScript = {
      id: 'copy_' + Date.now(),
      name: copyName,
      code: code,
      isDirty: false,
      isReadOnly: false,
      activeStudyId: null
    };
    const titleDisplay = document.getElementById('pine_script_title_display');
    if (titleDisplay) titleDisplay.textContent = copyName;
    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = 'none';
    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.readOnly = false;
      codeInput.focus();
    }
    document.getElementById('pine_menu_save_script')?.classList.remove('disabled');
    document.getElementById('pine_menu_rename')?.classList.remove('disabled');
    logConsoleV2(`${formatLogTime()} "${copyName}" created and opened`);
    pushRecentlyUsedScript(copyName);
    renderRecentlyUsedList();
    saveCurrentToStorage();
  }
'''

content = content.replace('function renderRecentlyUsedList() {', helpers + '\n  function renderRecentlyUsedList() {')

# 4. Update renderRecentlyUsedList to use pine-recent-item-v2
old_render_recent = '''  function renderRecentlyUsedList() {
    const list = document.getElementById('pine_dropdown_recent_list');
    if (!list) return;
    const recents = getRecentlyUsedScripts();
    list.innerHTML = '';
    recents.forEach(name => {
      const item = document.createElement('div');
      const isActive = name === _currentScript.name;
      item.className = 'pine-menu-recent-item' + (isActive ? ' active' : '');
      item.style.fontWeight = isActive ? '700' : '400';
      item.style.color = isActive ? '#fff' : '#b2b5be';
      item.innerHTML = `<span>${escapeHtml(name)}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
        const userScripts = getUserSavedScripts();
        const found = userScripts.find(s => s.name === name) || TEMPLATES.find(t => t.name === name);
        if (found) {
          loadScript(found.name, found.code, found.id);
        } else {
          loadScript(name, `//@version=5\\nindicator("${name}", overlay=true)\\nplot(close)\\n`, 'recent_' + Date.now());
        }
      });
      list.appendChild(item);
    });
  }'''

new_render_recent = '''  function renderRecentlyUsedList() {
    const list = document.getElementById('pine_dropdown_recent_list');
    if (!list) return;
    const recents = getRecentlyUsedScripts();
    list.innerHTML = '';
    recents.forEach(name => {
      const item = document.createElement('div');
      const isActive = name === _currentScript.name || (name.startsWith('Sessions') && _currentScript.name.startsWith('Sessions'));
      item.className = 'pine-recent-item-v2' + (isActive ? ' active' : '');
      item.innerHTML = `<span>${escapeHtml(name)}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
        const userScripts = getUserSavedScripts();
        const found = userScripts.find(s => s.name === name) || TEMPLATES.find(t => t.name === name || t.name.startsWith(name) || name.startsWith(t.name));
        if (found) {
          loadScript(found.name, found.code, found.id);
        } else {
          loadScript(name, `//@version=6\\nindicator("${name}", overlay=true)\\nplot(close)\\n`, 'recent_' + Date.now());
        }
        logConsoleV2(`${formatLogTime()} "${name}" opened`);
      });
      list.appendChild(item);
    });
  }'''

assert old_render_recent in content, "old_render_recent not found"
content = content.replace(old_render_recent, new_render_recent, 1)

# 5. Update bindEvents to wire up window buttons, more dropdown, console toggle, banner link
old_bind_events = '''    const dock = document.getElementById('pine_editor_dock');
    const codeInput = document.getElementById('pine_code_input');
    const dirtyInd = document.getElementById('pine_dirty_indicator');
    const cursorPos = document.getElementById('pine_cursor_pos');
    const saveBtn = document.getElementById('pine_save_btn');
    const compileBtn = document.getElementById('pine_compile_btn');
    const addChartBtn = document.getElementById('pine_add_to_chart_btn');
    const publishBtn = document.getElementById('pine_publish_btn');
    const toggleConsoleBtn = document.getElementById('pine_toggle_console_btn');
    const consoleDrawer = document.getElementById('pine_console_drawer');
    const maxBtn = document.getElementById('pine_maximize_btn');
    const closeBtn = document.getElementById('pine_close_dock_btn');
    const resizeHandle = document.getElementById('pine_resize_handle');

    // Image 3 Header Dropdown Menu Handling
    const dropdownTrigger = document.getElementById('pine_script_dropdown_trigger');
    const dropdownWrapper = document.getElementById('pine_dropdown_wrapper');
    const dropdownMenu = document.getElementById('pine_dropdown_menu');'''

new_bind_events = '''    const dock = document.getElementById('pine_editor_dock');
    const codeInput = document.getElementById('pine_code_input');
    const dirtyInd = document.getElementById('pine_dirty_indicator');
    const cursorPos = document.getElementById('pine_cursor_pos');
    const saveBtn = document.getElementById('pine_menu_save_script');
    const addChartBtn = document.getElementById('pine_add_to_chart_btn');
    const publishBtn = document.getElementById('pine_publish_btn');
    const toggleConsoleBtn = document.getElementById('pine_console_toggle_btn');
    const maxBtn = document.getElementById('pine_win_maximize');
    const minBtn = document.getElementById('pine_win_minimize');
    const closeBtn = document.getElementById('pine_win_close');
    const resizeHandle = document.getElementById('pine_resize_handle');

    // Window Controls
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        setDockOpen(false);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        setDockOpen(false);
      });
    }

    // Console Toggle [>_]
    if (toggleConsoleBtn) {
      toggleConsoleBtn.addEventListener('click', () => {
        toggleConsoleDrawerV2();
      });
    }

    // Read-only banner copy link
    const bannerCopyBtn = document.getElementById('pine_banner_copy_btn');
    if (bannerCopyBtn) {
      bannerCopyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        makeCopyOfCurrentScript();
      });
    }

    // Top Right More Actions (•••) Dropdown
    const moreBtn = document.getElementById('pine_more_btn');
    const moreMenu = document.getElementById('pine_more_menu');
    const moreWrapper = document.getElementById('pine_more_wrapper');

    if (moreBtn && moreMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
        const isOpen = moreMenu.classList.contains('show');
        if (isOpen) {
          moreMenu.classList.remove('show');
        } else {
          moreMenu.classList.add('show');
        }
      });

      document.addEventListener('click', (e) => {
        if (moreWrapper && !moreWrapper.contains(e.target)) {
          moreMenu.classList.remove('show');
        }
      });
    }

    // More Menu actions
    document.getElementById('pine_menu_editor_settings')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      alert("Pine Editor Settings: Authentic TradingView v6 Engine Active.");
    });
    document.getElementById('pine_menu_open_new_window')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open(window.location.href, '_blank', 'width=1000,height=750');
    });
    document.getElementById('pine_menu_open_new_tab')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open(window.location.href, '_blank');
    });
    document.getElementById('pine_menu_pine_logs')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      const drawer = document.getElementById('pine_console_drawer_v2');
      if (drawer) drawer.style.display = 'block';
    });
    document.getElementById('pine_menu_release_notes')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open('https://www.tradingview.com/pine-script-docs/en/v6/Release_notes.html', '_blank');
    });
    document.getElementById('pine_menu_help')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open('https://www.tradingview.com/pine-script-docs/en/v6/', '_blank');
    });

    // Add to chart action
    if (addChartBtn) {
      addChartBtn.addEventListener('click', () => {
        logConsoleV2(`${formatLogTime()} "${_currentScript.name}" added to chart`);
        runCompilation(true);
      });
    }

    // Publish script action
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        alert("Publish Script: This script is ready for publication to the TradingView community library.");
      });
    }

    // Image 2 Script Dropdown Menu Handling
    const dropdownTrigger = document.getElementById('pine_script_dropdown_trigger');
    const dropdownWrapper = document.getElementById('pine_dropdown_wrapper');
    const dropdownMenu = document.getElementById('pine_dropdown_menu');'''

assert old_bind_events in content, "old_bind_events not found"
content = content.replace(old_bind_events, new_bind_events, 1)

# 6. Update makeScriptCopy handler in bindEvents to use makeCopyOfCurrentScript
content = content.replace('makeScriptCopy();', 'makeCopyOfCurrentScript();')

with open('pine_editor_ide.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("Successfully updated pine_editor_ide.js with 1:1 TradingView UI structure")
