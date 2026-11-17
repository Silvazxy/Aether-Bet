'use strict';

/* =========================================================================
   1. FORMATTERS & WEB AUDIO API SOUND ENGINE (ZERO EXTERNAL URLS)
   ========================================================================= */
const brlFormatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

function formatBRL(val) {
    return brlFormatter.format(Number.isFinite(val) ? val : 0);
}

function formatMult(val) {
    return `${Number(val).toFixed(2)}x`;
}

const SoundFX = (() => {
    let enabled = localStorage.getItem('aether_audio') !== 'false';
    let ctx = null;

    function getCtx() {
        if (!enabled) return null;
        if (!ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) ctx = new AudioCtx();
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
        return ctx;
    }

    function updateIcon() {
        const onEl = document.getElementById('audioIconOn');
        const offEl = document.getElementById('audioIconOff');
        if (onEl) onEl.classList.toggle('hidden', !enabled);
        if (offEl) offEl.classList.toggle('hidden', enabled);
    }

    function toggle() {
        enabled = !enabled;
        localStorage.setItem('aether_audio', String(enabled));
        updateIcon();
        if (enabled) play('click');
        App.showToast(enabled ? 'Efeitos sonoros ativados.' : 'Efeitos sonoros silenciados.', 'info');
    }

    function play(type, param = 1) {
        const c = getCtx();
        if (!c) return;
        const now = c.currentTime;
        const osc = c.createOscillator();
        const gain = c.createGain();
        osc.connect(gain);
        gain.connect(c.destination);

        if (type === 'click') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(540, now);
            osc.frequency.exponentialRampToValueAtTime(260, now + 0.045);
            gain.gain.setValueAtTime(0.06, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'gem') {
            const base = 580 + Math.min(param * 45, 720);
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(base, now);
            osc.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.14);
            gain.gain.setValueAtTime(0.11, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
            osc.start(now);
            osc.stop(now + 0.17);
        } else if (type === 'peg') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(760 + (param % 6) * 55, now);
            gain.gain.setValueAtTime(0.025, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
            osc.start(now);
            osc.stop(now + 0.035);
        } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
                const o = c.createOscillator();
                const g = c.createGain();
                o.type = 'triangle';
                o.frequency.setValueAtTime(freq, now + idx * 0.06);
                g.gain.setValueAtTime(0.09, now + idx * 0.06);
                g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);
                o.connect(g);
                g.connect(c.destination);
                o.start(now + idx * 0.06);
                o.stop(now + idx * 0.06 + 0.26);
            });
        } else if (type === 'loss') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(175, now);
            osc.frequency.exponentialRampToValueAtTime(68, now + 0.28);
            gain.gain.setValueAtTime(0.1, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.31);
        }
    }

    return { toggle, play, updateIcon };
})();

/* =========================================================================
   2. PARTICLE CELEBRATION OVERLAY
   ========================================================================= */
const CelebrationFX = (() => {
    const particles = [];
    let running = false;

    function burst() {
        const canvas = document.getElementById('celebrationCanvas');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        const colors = ['#38bdf8', '#3b82f6', '#10b981', '#93c5fd'];

        for (let i = 0; i < 55; i++) {
            const angle = (Math.PI * 2 * i) / 55 + (Math.random() - 0.5) * 0.2;
            const speed = 3 + Math.random() * 6;
            particles.push({
                x: canvas.width * 0.5,
                y: canvas.height * 0.42,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: 4 + Math.random() * 4,
                color: colors[i % colors.length],
                alpha: 1,
                rot: Math.random() * Math.PI,
            });
        }

        if (!running) {
            running = true;
            requestAnimationFrame(loop);
        }
    }

    function loop() {
        const canvas = document.getElementById('celebrationCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.16;
            p.alpha -= 0.018;
            p.rot += 0.08;

            if (p.alpha <= 0) {
                particles.splice(i, 1);
                continue;
            }

            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
            ctx.restore();
        }

        if (particles.length > 0) {
            requestAnimationFrame(loop);
        } else {
            running = false;
        }
    }

    return { burst };
})();

/* =========================================================================
   3. CORE APPLICATION CONTROLLER, AUTHENTICATION & WALLET
   ========================================================================= */
const App = (() => {
    const USERS_KEY = 'aether_users';
    const SESSION_KEY = 'aether_session';

    let users = loadUsers();
    let currentUser = loadSessionUser();
    let currentView = 'home';
    let currentGame = 'crash';
    let pendingPixAmount = 0;

    const communityFeed = [
        { game: 'Crash', player: 'Rafael M.', bet: 50.00, mult: 3.42, payout: 171.00 },
        { game: 'Tower', player: 'Camila S.', bet: 25.00, mult: 4.10, payout: 102.50 },
        { game: 'Mines', player: 'Bruno K.', bet: 100.00, mult: 2.18, payout: 218.00 },
        { game: 'Double', player: 'Thiago R.', bet: 40.00, mult: 14.00, payout: 560.00 },
        { game: 'Plinko', player: 'Larissa P.', bet: 20.00, mult: 5.60, payout: 112.00 },
    ];

    function loadUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    function saveUsers() {
        try {
            localStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (e) { }
    }

    function loadSessionUser() {
        try {
            const sessionId = localStorage.getItem(SESSION_KEY);
            if (!sessionId) return null;
            return users.find(u => u.id === sessionId) || null;
        } catch (e) {
            return null;
        }
    }

    function persistCurrentUser() {
        if (!currentUser) return;
        const idx = users.findIndex(u => u.id === currentUser.id);
        if (idx !== -1) {
            users[idx] = currentUser;
        } else {
            users.push(currentUser);
        }
        saveUsers();
        localStorage.setItem(SESSION_KEY, currentUser.id);
    }

    /* ---------- Strict Visitor Guard ---------- */
    function requireAuth(reasonMsg = 'Crie sua conta gratuita ou faça login para continuar.') {
        if (currentUser) return true;
        SoundFX.play('click');
        openAuthModal('login', reasonMsg);
        return false;
    }

    /* ---------- Toast Notification System (Bottom-Right) ---------- */
    function showToast(message, variant = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        const styles = {
            success: 'bg-[#0d1424] border-emerald-500/50 text-emerald-300',
            error: 'bg-[#0d1424] border-red-500/50 text-red-300',
            info: 'bg-[#0d1424] border-blue-500/50 text-cyan-200',
        };
        const dots = {
            success: 'bg-emerald-400',
            error: 'bg-red-400',
            info: 'bg-cyan-400',
        };

        toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border shadow-2xl shadow-black/70 text-xs sm:text-sm font-medium transition-all duration-200 translate-y-3 opacity-0 ${styles[variant] || styles.info}`;
        toast.innerHTML = `
          <span class="w-2 h-2 rounded-full shrink-0 ${dots[variant] || dots.info}"></span>
          <span class="leading-snug">${message}</span>
        `;
        container.appendChild(toast);

        requestAnimationFrame(() => {
            toast.classList.remove('translate-y-3', 'opacity-0');
        });

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-3');
            setTimeout(() => toast.remove(), 220);
        }, 3200);
    }

    /* ---------- CPF Formatting & Brazilian Check-Digit Validation ---------- */
    function formatCpfInput(input) {
        let digits = input.value.replace(/\D/g, '').slice(0, 11);
        if (digits.length > 9) {
            digits = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else if (digits.length > 6) {
            digits = digits.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (digits.length > 3) {
            digits = digits.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        input.value = digits;
    }

    function isValidCpf(cpfFormatted) {
        const cpf = cpfFormatted.replace(/\D/g, '');
        if (cpf.length !== 11) return false;
        if (/^(\d)\1{10}$/.test(cpf)) return false;

        let sum = 0;
        for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i), 10) * (10 - i);
        let rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        if (rev !== parseInt(cpf.charAt(9), 10)) return false;

        sum = 0;
        for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i), 10) * (11 - i);
        rev = 11 - (sum % 11);
        if (rev === 10 || rev === 11) rev = 0;
        return rev === parseInt(cpf.charAt(10), 10);
    }

    function generateValidCpfString() {
        const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
        if (n.every(d => d === n[0])) n[8] = (n[0] + 1) % 10;

        let s1 = 0;
        for (let i = 0; i < 9; i++) s1 += n[i] * (10 - i);
        let d1 = 11 - (s1 % 11);
        if (d1 >= 10) d1 = 0;
        n.push(d1);

        let s2 = 0;
        for (let i = 0; i < 10; i++) s2 += n[i] * (11 - i);
        let d2 = 11 - (s2 % 11);
        if (d2 >= 10) d2 = 0;
        n.push(d2);

        const raw = n.join('');
        return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    function fillValidSampleCpf() {
        SoundFX.play('click');
        const input = document.getElementById('regCpf');
        input.value = generateValidCpfString();
        clearRegErrors();
    }

    /* ---------- Auth Modal Controls ---------- */
    function openAuthModal(mode = 'register', bannerMessage = null) {
        const modal = document.getElementById('authModal');
        modal.classList.remove('hidden');
        modal.classList.add('flex');

        const bannerBox = document.getElementById('authBannerBox');
        const bannerText = document.getElementById('authBannerText');
        if (bannerMessage) {
            bannerText.textContent = bannerMessage;
            bannerBox.classList.remove('hidden');
        } else {
            bannerBox.classList.add('hidden');
        }

        setAuthMode(mode);
    }

    function closeAuthModal() {
        const modal = document.getElementById('authModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    function setAuthMode(mode) {
        const isRegister = mode === 'register';
        document.getElementById('registerForm').classList.toggle('hidden', !isRegister);
        document.getElementById('loginForm').classList.toggle('hidden', isRegister);

        document.getElementById('authTabRegister').className = `py-2 rounded-lg text-sm font-semibold transition-colors ${isRegister ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`;
        document.getElementById('authTabLogin').className = `py-2 rounded-lg text-sm font-semibold transition-colors ${!isRegister ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`;

        clearRegErrors();
        document.getElementById('errLoginGeneral').classList.add('hidden');
    }

    function clearRegErrors() {
        ['errRegName', 'errRegEmail', 'errRegCpf', 'errRegPassword', 'errRegConfirm'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.textContent = '';
                el.classList.add('hidden');
            }
        });
    }

    function setFieldError(id, msg) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = msg;
            el.classList.remove('hidden');
        }
    }

    function handleRegister(e) {
        e.preventDefault();
        clearRegErrors();

        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim().toLowerCase();
        const cpf = document.getElementById('regCpf').value.trim();
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        const bonusActive = document.getElementById('regWelcomeBonus').checked;

        let valid = true;

        if (name.length < 3) {
            setFieldError('errRegName', 'Informe seu nome completo (mínimo 3 caracteres).');
            valid = false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setFieldError('errRegEmail', 'Informe um endereço de e-mail válido.');
            valid = false;
        } else if (users.some(u => u.email === email)) {
            setFieldError('errRegEmail', 'Este e-mail já está cadastrado. Faça login na aba Entrar.');
            valid = false;
        }

        if (!isValidCpf(cpf)) {
            setFieldError('errRegCpf', 'CPF inválido. Verifique os dígitos ou clique em "Gerar CPF válido".');
            valid = false;
        }

        if (password.length < 6) {
            setFieldError('errRegPassword', 'A senha deve conter no mínimo 6 caracteres.');
            valid = false;
        }

        if (password !== confirm) {
            setFieldError('errRegConfirm', 'As senhas não coincidem.');
            valid = false;
        }

        if (!valid) {
            SoundFX.play('loss');
            return;
        }

        const initialBalance = bonusActive ? 100.00 : 0.00;
        const nowStr = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

        const newUser = {
            id: 'USR-' + Date.now(),
            name,
            email,
            cpf,
            password,
            balance: initialBalance,
            bonusActive,
            createdAt: new Date().toLocaleDateString('pt-BR'),
            transactions: bonusActive
                ? [{
                    id: 'TX-' + Math.floor(1000 + Math.random() * 9000),
                    type: 'Bônus Boas-Vindas',
                    detail: 'Ativação inicial simulada',
                    date: nowStr,
                    amount: 100.00,
                    status: 'Concluído',
                }]
                : [],
            bets: [],
            stats: {
                wagered: 0,
                won: 0,
                maxMult: 0,
            },
        };

        users.push(newUser);
        currentUser = newUser;
        persistCurrentUser();

        document.getElementById('registerForm').reset();
        document.getElementById('regWelcomeBonus').checked = true;

        closeAuthModal();
        syncAuthStateUI();
        SoundFX.play('win');
        showToast(
            bonusActive
                ? `Bem-vindo, ${name.split(' ')[0]}! Bônus de R$ 100,00 ativado.`
                : `Conta criada com sucesso, ${name.split(' ')[0]}! Deposite via PIX para começar.`,
            'success'
        );
    }

    function handleLogin(e) {
        e.preventDefault();
        const errBox = document.getElementById('errLoginGeneral');
        errBox.classList.add('hidden');

        const email = document.getElementById('loginEmail').value.trim().toLowerCase();
        const password = document.getElementById('loginPassword').value;

        const found = users.find(u => u.email === email && u.password === password);
        if (!found) {
            errBox.textContent = 'E-mail ou senha incorretos. Verifique seus dados ou crie uma conta.';
            errBox.classList.remove('hidden');
            SoundFX.play('loss');
            return;
        }

        currentUser = found;
        persistCurrentUser();
        document.getElementById('loginForm').reset();

        closeAuthModal();
        syncAuthStateUI();
        SoundFX.play('win');
        showToast(`Bem-vindo de volta, ${currentUser.name.split(' ')[0]}.`, 'success');
    }

    function loginDemoAccount() {
        const demoEmail = 'demo@aetherbet.sim';
        let demoUser = users.find(u => u.email === demoEmail);
        if (!demoUser) {
            demoUser = {
                id: 'USR-DEMO-01',
                name: 'Jogador Demo Aether',
                email: demoEmail,
                cpf: generateValidCpfString(),
                password: 'demo123',
                balance: 500.00,
                bonusActive: true,
                createdAt: new Date().toLocaleDateString('pt-BR'),
                transactions: [{
                    id: 'TX-DEMO',
                    type: 'Bônus Demo',
                    detail: 'Saldo inicial de demonstração',
                    date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
                    amount: 500.00,
                    status: 'Concluído',
                }],
                bets: [],
                stats: { wagered: 0, won: 0, maxMult: 0 },
            };
            users.push(demoUser);
        } else if (demoUser.balance < 10) {
            demoUser.balance = 500.00;
        }

        currentUser = demoUser;
        persistCurrentUser();
        closeAuthModal();
        syncAuthStateUI();
        SoundFX.play('win');
        showToast('Conectado à Conta Demo com R$ 500,00.', 'success');
    }

    function logout() {
        SoundFX.play('click');
        currentUser = null;
        localStorage.removeItem(SESSION_KEY);
        syncAuthStateUI();
        if (currentView === 'wallet' || currentView === 'account') {
            navigateTo('home');
        }
        showToast('Você saiu da sua conta. Modo visitante ativo.', 'info');
    }

    /* ---------- UI Sync for Visitor vs Logged-In User ---------- */
    function syncAuthStateUI() {
        const guestHeader = document.getElementById('headerGuestControls');
        const userHeader = document.getElementById('headerUserControls');
        const heroCta = document.getElementById('heroPrimaryCta');
        const betHint = document.getElementById('betBalanceHint');

        if (currentUser) {
            guestHeader.classList.add('hidden');
            userHeader.classList.remove('hidden');
            userHeader.classList.add('flex');

            const parts = currentUser.name.trim().split(/\s+/);
            const initials = (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || '')).toUpperCase();
            document.getElementById('headerAvatar').textContent = initials;
            document.getElementById('headerUsername').textContent = parts[0];

            if (heroCta) {
                heroCta.innerHTML = `
              <span>Depositar via PIX</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            `;
                heroCta.onclick = () => openWallet('deposit');
            }

            if (betHint) {
                betHint.textContent = `Saldo: ${formatBRL(currentUser.balance)}`;
            }
        } else {
            guestHeader.classList.remove('hidden');
            userHeader.classList.add('hidden');
            userHeader.classList.remove('flex');

            if (heroCta) {
                heroCta.innerHTML = `
              <span>Criar Conta Grátis</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            `;
                heroCta.onclick = () => openAuthModal('register');
            }

            if (betHint) {
                betHint.textContent = 'Visitante';
            }
        }

        updateBalanceDisplays();
        renderAccountView();
        renderWalletHistory();

        // Refresh active game action buttons so visitor immediately sees "Entrar para Apostar" or active controls
        if (currentView === 'game') {
            if (currentGame === 'crash') CrashGame.updateActionBtn();
            if (currentGame === 'mines') MinesGame.updateUI();
            if (currentGame === 'tower') TowerGame.updateUI();
            if (currentGame === 'dice') DiceGame.updateUI();
            if (currentGame === 'plinko') PlinkoGame.updateUI();
            if (currentGame === 'double') DoubleGame.updateUI();
        }
    }

    function updateBalanceDisplays() {
        const bal = currentUser ? currentUser.balance : 0;
        const formatted = formatBRL(bal);
        const hBal = document.getElementById('headerBalance');
        const wBal = document.getElementById('walletBalanceDisplay');
        const betHint = document.getElementById('betBalanceHint');

        if (hBal) hBal.textContent = formatted;
        if (wBal) wBal.textContent = formatted;
        if (betHint) betHint.textContent = currentUser ? `Saldo: ${formatted}` : 'Visitante';
    }

    /* ---------- Bet Validation & Settlement ---------- */
    function getBetAmount() {
        const input = document.getElementById('betAmountInput');
        const val = parseFloat(input ? input.value : 0);
        return Number.isFinite(val) ? Math.round(val * 100) / 100 : 0;
    }

    function placeBet(amount) {
        if (!requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) {
            return false;
        }
        if (!Number.isFinite(amount) || amount < 1) {
            showToast('Aposta mínima de R$ 1,00.', 'error');
            return false;
        }
        if (amount > currentUser.balance) {
            showToast('Saldo insuficiente. Deposite via PIX na Carteira.', 'error');
            SoundFX.play('loss');
            return false;
        }

        currentUser.balance = Math.round((currentUser.balance - amount) * 100) / 100;
        currentUser.stats.wagered = Math.round((currentUser.stats.wagered + amount) * 100) / 100;
        persistCurrentUser();
        updateBalanceDisplays();
        return true;
    }

    function settleWin(payout, multiplier) {
        if (!currentUser || payout <= 0) return;
        currentUser.balance = Math.round((currentUser.balance + payout) * 100) / 100;
        currentUser.stats.won = Math.round((currentUser.stats.won + payout) * 100) / 100;
        if (multiplier > currentUser.stats.maxMult) {
            currentUser.stats.maxMult = multiplier;
        }
        if (multiplier >= 5) {
            CelebrationFX.burst();
        }
        persistCurrentUser();
        updateBalanceDisplays();
    }

    function recordGameBet(gameName, betAmount, multiplier, payout) {
        if (currentUser) {
            const net = Math.round((payout - betAmount) * 100) / 100;
            currentUser.bets.unshift({
                game: gameName,
                bet: betAmount,
                mult: payout > 0 ? multiplier : 0,
                payout,
                net,
                date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            });
            if (currentUser.bets.length > 30) currentUser.bets.pop();
            persistCurrentUser();
        }

        const displayName = currentUser ? currentUser.name.split(' ')[0] : 'Jogador';
        communityFeed.unshift({
            game: gameName,
            player: displayName,
            bet: betAmount,
            mult: payout > 0 ? multiplier : 0,
            payout,
        });
        if (communityFeed.length > 10) communityFeed.pop();
        renderRecentBets();
        renderAccountView();
    }

    function renderRecentBets() {
        const tbody = document.getElementById('recentBetsBody');
        if (!tbody) return;
        tbody.innerHTML = communityFeed.map(item => {
            const isWin = item.payout > 0;
            return `
            <tr class="hover:bg-[#131d33]/50 transition-colors">
              <td class="py-2.5 px-3 font-semibold text-white">${item.game}</td>
              <td class="py-2.5 px-3 text-slate-400">${item.player}</td>
              <td class="py-2.5 px-3 text-right font-mono text-slate-300 tabular-nums">${formatBRL(item.bet)}</td>
              <td class="py-2.5 px-3 text-right font-mono font-semibold tabular-nums ${isWin ? 'text-cyan-400' : 'text-slate-500'}">
                ${isWin ? formatMult(item.mult) : '0.00x'}
              </td>
              <td class="py-2.5 px-3 text-right font-mono font-bold tabular-nums ${isWin ? 'text-emerald-400' : 'text-slate-500'}">
                ${isWin ? formatBRL(item.payout) : formatBRL(0)}
              </td>
            </tr>
          `;
        }).join('');
    }

    /* ---------- Navigation & Protected Route Guard ---------- */
    function navigateTo(view) {
        if ((view === 'wallet' || view === 'account') && !currentUser) {
            requireAuth(
                view === 'wallet'
                    ? 'Faça login ou crie sua conta gratuita para acessar a Carteira.'
                    : 'Faça login ou crie sua conta gratuita para visualizar Minha Conta.'
            );
            return;
        }

        SoundFX.play('click');
        currentView = view;

        ['home', 'game', 'wallet', 'account'].forEach(v => {
            const el = document.getElementById(`view-${v}`);
            if (el) el.classList.toggle('hidden', v !== view);
        });

        document.querySelectorAll('.nav-link').forEach(btn => {
            const isMatch = (btn.dataset.nav === view) || (btn.dataset.nav === 'games' && view === 'game');
            btn.classList.toggle('text-white', isMatch);
            btn.classList.toggle('bg-[#131d33]', isMatch);
        });

        if (view === 'wallet') renderWalletHistory();
        if (view === 'account') renderAccountView();
        if (view === 'game') {
            CrashGame.resize();
            PlinkoGame.resize();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    function openGame(gameId) {
        currentGame = gameId;
        navigateTo('game');

        const titles = {
            crash: 'Crash',
            mines: 'Mines',
            tower: 'Tower',
            dice: 'Dice',
            plinko: 'Plinko',
            double: 'Double',
        };
        document.getElementById('activeGameTitle').textContent = titles[gameId] || 'Jogo';

        document.querySelectorAll('.game-pill').forEach(pill => {
            const active = pill.dataset.gamepill === gameId;
            pill.className = `game-pill px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-[#0d1424] border border-blue-500/20 text-slate-400 hover:text-white'
                }`;
        });

        ['crash', 'mines', 'tower', 'dice', 'plinko', 'double'].forEach(g => {
            document.getElementById(`stage-${g}`).classList.toggle('hidden', g !== gameId);
        });

        if (gameId === 'crash') CrashGame.init();
        if (gameId === 'mines') MinesGame.init();
        if (gameId === 'tower') TowerGame.init();
        if (gameId === 'dice') DiceGame.init();
        if (gameId === 'plinko') PlinkoGame.init();
        if (gameId === 'double') DoubleGame.init();
    }

    function adjustBet(factor) {
        SoundFX.play('click');
        const input = document.getElementById('betAmountInput');
        const cur = getBetAmount() || 10;
        const maxAllowed = currentUser && currentUser.balance >= 1 ? currentUser.balance : 10000;
        input.value = Math.max(1, Math.min(maxAllowed, Math.round(cur * factor * 100) / 100));
        onBetInputChange();
    }

    function setMaxBet() {
        if (!requireAuth('Faça login ou crie uma conta para usar seu saldo.')) return;
        SoundFX.play('click');
        const input = document.getElementById('betAmountInput');
        input.value = Math.max(1, Math.floor(currentUser.balance * 100) / 100);
        onBetInputChange();
    }

    function onBetInputChange() {
        if (currentGame === 'mines') MinesGame.updateUI();
        if (currentGame === 'tower') TowerGame.updateUI();
        if (currentGame === 'dice') DiceGame.updateUI();
    }

    /* ---------- Wallet Actions ---------- */
    function openWallet(tab = 'deposit') {
        if (!requireAuth('Faça login ou crie uma conta para acessar a Carteira.')) return;
        navigateTo('wallet');
        switchWalletTab(tab);
    }

    function switchWalletTab(tab) {
        SoundFX.play('click');
        ['deposit', 'withdraw', 'history'].forEach(t => {
            document.getElementById(`walletTab-${t}`).classList.toggle('hidden', t !== tab);
            const btn = document.getElementById(`walletTabBtn-${t}`);
            btn.className = t === tab
                ? 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 text-white transition-colors'
                : 'px-4 py-2.5 rounded-xl text-sm font-semibold bg-[#131d33] text-slate-300 hover:text-white border border-blue-500/20 transition-colors';
        });
        if (tab === 'history') renderWalletHistory();
    }

    function setDepositAmount(val) {
        SoundFX.play('click');
        document.getElementById('depositAmountInput').value = val;
    }

    function generatePixCharge() {
        if (!requireAuth()) return;
        const raw = parseFloat(document.getElementById('depositAmountInput').value);
        if (!Number.isFinite(raw) || raw < 5) {
            showToast('Valor mínimo de depósito é R$ 5,00.', 'error');
            return;
        }

        const promo = document.getElementById('depositPromoInput').value.trim().toUpperCase();
        let total = raw;
        if (promo === 'AZUL100') {
            total = raw * 2;
            showToast('Cupom AZUL100 aplicado: +100% de bônus.', 'success');
        }

        pendingPixAmount = Math.round(total * 100) / 100;
        SoundFX.play('click');

        document.getElementById('pixTotalCreditLabel').textContent = formatBRL(pendingPixAmount);
        const token = Math.random().toString(36).substring(2, 12).toUpperCase();
        document.getElementById('pixCopyCodeInput').value = `00020126580014BR.GOV.BCB.PIX0136AETHER-${token}5204000053039865802BR5910AETHER BET6009SAO PAULO6304`;

        renderQrSvg(token);
        document.getElementById('pixFormContainer').classList.add('hidden');
        document.getElementById('pixCheckoutBox').classList.remove('hidden');
    }

    function renderQrSvg(seed) {
        const svg = document.getElementById('pixQrSvg');
        let rects = '';
        const drawFinder = (ox, oy) => {
            rects += `<rect x="${ox}" y="${oy}" width="7" height="7" fill="none" stroke="currentColor" stroke-width="1"/>`;
            rects += `<rect x="${ox + 2}" y="${oy + 2}" width="3" height="3" fill="currentColor"/>`;
        };
        drawFinder(0.5, 0.5);
        drawFinder(21.5, 0.5);
        drawFinder(0.5, 21.5);

        let h = 0;
        for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
        for (let y = 0; y < 29; y++) {
            for (let x = 0; x < 29; x++) {
                if ((x < 8 && y < 8) || (x > 20 && y < 8) || (x < 8 && y > 20)) continue;
                h = (h * 1664525 + 1013904223) >>> 0;
                if ((h & 1) === 1) rects += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
            }
        }
        svg.innerHTML = rects;
    }

    function copyPixCode() {
        const input = document.getElementById('pixCopyCodeInput');
        input.select();
        input.setSelectionRange(0, 99999);
        try {
            document.execCommand('copy');
            SoundFX.play('click');
            showToast('Código PIX Copia e Cola copiado.', 'success');
        } catch (e) {
            showToast('Selecione e copie o código manualmente.', 'info');
        }
    }

    function confirmPixDeposit() {
        if (!currentUser || pendingPixAmount <= 0) return;
        currentUser.balance = Math.round((currentUser.balance + pendingPixAmount) * 100) / 100;
        currentUser.transactions.unshift({
            id: 'TX-' + Math.floor(1000 + Math.random() * 9000),
            type: 'Depósito PIX',
            detail: 'PIX Instantâneo Simulado',
            date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            amount: pendingPixAmount,
            status: 'Concluído',
        });

        persistCurrentUser();
        updateBalanceDisplays();
        renderWalletHistory();
        SoundFX.play('win');
        showToast(`Depósito de ${formatBRL(pendingPixAmount)} confirmado.`, 'success');
        resetPixForm();
    }

    function resetPixForm() {
        pendingPixAmount = 0;
        document.getElementById('pixCheckoutBox').classList.add('hidden');
        document.getElementById('pixFormContainer').classList.remove('hidden');
        document.getElementById('depositPromoInput').value = '';
    }

    function setMaxWithdraw() {
        if (!currentUser) return;
        SoundFX.play('click');
        document.getElementById('withdrawAmountInput').value = currentUser.balance.toFixed(2);
    }

    function processWithdraw() {
        if (!requireAuth()) return;
        const keyType = document.getElementById('withdrawKeyType').value;
        const keyVal = document.getElementById('withdrawKeyInput').value.trim();
        const amount = parseFloat(document.getElementById('withdrawAmountInput').value);

        if (!keyVal) {
            showToast('Informe a chave PIX para saque.', 'error');
            return;
        }
        if (!Number.isFinite(amount) || amount < 10) {
            showToast('Valor mínimo de saque é R$ 10,00.', 'error');
            return;
        }
        if (amount > currentUser.balance) {
            showToast('Saldo insuficiente para realizar este saque.', 'error');
            SoundFX.play('loss');
            return;
        }

        currentUser.balance = Math.round((currentUser.balance - amount) * 100) / 100;
        currentUser.transactions.unshift({
            id: 'TX-' + Math.floor(1000 + Math.random() * 9000),
            type: 'Saque PIX',
            detail: `${keyType}: ${keyVal}`,
            date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            amount: -amount,
            status: 'Concluído',
        });

        document.getElementById('withdrawAmountInput').value = '';
        persistCurrentUser();
        updateBalanceDisplays();
        renderWalletHistory();
        SoundFX.play('win');
        showToast(`Saque de ${formatBRL(amount)} processado com sucesso.`, 'success');
    }

    function renderWalletHistory() {
        const tbody = document.getElementById('txHistoryBody');
        const badge = document.getElementById('txCountBadge');
        if (!tbody || !currentUser) return;

        const list = currentUser.transactions || [];
        badge.textContent = `${list.length} registros`;

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="py-8 text-center text-slate-500 text-xs">Nenhuma movimentação registrada ainda.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(tx => {
            const isPos = tx.amount >= 0;
            return `
            <tr class="hover:bg-[#131d33]/50">
              <td class="py-3 px-3 font-semibold text-white">${tx.type}</td>
              <td class="py-3 px-3 text-slate-400 text-xs">${tx.detail || '-'}</td>
              <td class="py-3 px-3 text-slate-400 text-xs font-mono">${tx.date}</td>
              <td class="py-3 px-3 text-right font-mono font-bold tabular-nums ${isPos ? 'text-emerald-400' : 'text-slate-300'}">
                ${isPos ? '+' : ''}${formatBRL(tx.amount)}
              </td>
              <td class="py-3 px-3 text-right">
                <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  ${tx.status}
                </span>
              </td>
            </tr>
          `;
        }).join('');
    }

    /* ---------- Account View & Security ---------- */
    function renderAccountView() {
        if (!currentUser) return;

        const parts = currentUser.name.trim().split(/\s+/);
        const initials = (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || '')).toUpperCase();
        document.getElementById('profileAvatarLarge').textContent = initials;
        document.getElementById('profileNameDisplay').textContent = currentUser.name;
        document.getElementById('profileEmailDisplay').textContent = currentUser.email;

        const digits = (currentUser.cpf || '').replace(/\D/g, '');
        const maskedCpf = digits.length === 11
            ? `***.${digits.slice(3, 6)}.${digits.slice(6, 9)}-**`
            : '***.000.000-**';
        document.getElementById('profileCpfDisplay').textContent = `CPF: ${maskedCpf}`;
        document.getElementById('profileCreatedDisplay').textContent = `Cadastro: ${currentUser.createdAt || '--/--/----'}`;

        const wagered = currentUser.stats.wagered || 0;
        const won = currentUser.stats.won || 0;
        const net = Math.round((won - wagered) * 100) / 100;

        document.getElementById('statTotalWagered').textContent = formatBRL(wagered);
        document.getElementById('statTotalWon').textContent = formatBRL(won);
        const netEl = document.getElementById('statNetProfit');
        netEl.textContent = `${net > 0 ? '+' : ''}${formatBRL(net)}`;
        netEl.className = `font-mono text-xl sm:text-2xl font-bold mt-2 tabular-nums ${net > 0 ? 'text-emerald-400' : net < 0 ? 'text-red-400' : 'text-slate-200'
            }`;
        document.getElementById('statMaxMult').textContent = formatMult(currentUser.stats.maxMult || 0);
    }

    function handleChangePassword(e) {
        e.preventDefault();
        if (!currentUser) return;
        const curPwd = document.getElementById('currentPwdInput').value;
        const newPwd = document.getElementById('newPwdInput').value;

        if (curPwd !== currentUser.password) {
            showToast('Senha atual incorreta.', 'error');
            SoundFX.play('loss');
            return;
        }
        if (newPwd.length < 6) {
            showToast('A nova senha deve ter pelo menos 6 caracteres.', 'error');
            return;
        }

        currentUser.password = newPwd;
        persistCurrentUser();
        e.target.reset();
        SoundFX.play('win');
        showToast('Senha atualizada com sucesso.', 'success');
    }

    function promptResetBalance() {
        document.getElementById('resetBalanceArea').innerHTML = `
          <div class="flex items-center gap-2">
            <button type="button" onclick="App.confirmResetBalance()" class="flex-1 py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors">
              Confirmar Reset (R$ 100,00)
            </button>
            <button type="button" onclick="App.cancelResetBalance()" class="py-2.5 px-3 rounded-xl bg-[#131d33] border border-blue-500/20 text-xs font-semibold text-slate-300">
              Cancelar
            </button>
          </div>
        `;
    }

    function cancelResetBalance() {
        document.getElementById('resetBalanceArea').innerHTML = `
          <button type="button" onclick="App.promptResetBalance()" class="w-full py-2.5 px-4 rounded-xl bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 text-red-400 text-sm font-semibold transition-colors">
            Resetar Saldo Simulado
          </button>
        `;
    }

    function confirmResetBalance() {
        if (!currentUser) return;
        currentUser.balance = 100.00;
        currentUser.transactions.unshift({
            id: 'TX-' + Math.floor(1000 + Math.random() * 9000),
            type: 'Reset Simulado',
            detail: 'Restauração de saldo inicial',
            date: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
            amount: 100.00,
            status: 'Concluído',
        });
        persistCurrentUser();
        updateBalanceDisplays();
        cancelResetBalance();
        SoundFX.play('click');
        showToast('Saldo simulado restaurado para R$ 100,00.', 'success');
    }

    /* ---------- Menus & Helpers ---------- */
    function toggleMobileMenu() {
        const drawer = document.getElementById('mobileNavDrawer');
        const openIcon = document.getElementById('mobileMenuIconOpen');
        const closeIcon = document.getElementById('mobileMenuIconClose');
        const isHidden = drawer.classList.contains('hidden');
        drawer.classList.toggle('hidden', !isHidden);
        openIcon.classList.toggle('hidden', isHidden);
        closeIcon.classList.toggle('hidden', !isHidden);
    }

    function closeMobileMenu() {
        document.getElementById('mobileNavDrawer').classList.add('hidden');
        document.getElementById('mobileMenuIconOpen').classList.remove('hidden');
        document.getElementById('mobileMenuIconClose').classList.add('hidden');
    }

    function toggleUserDropdown() {
        document.getElementById('userDropdownMenu').classList.toggle('hidden');
    }

    function closeUserDropdown() {
        document.getElementById('userDropdownMenu').classList.add('hidden');
    }

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('userDropdownMenu');
        const btn = document.getElementById('userMenuBtn');
        if (menu && btn && !menu.contains(e.target) && !btn.contains(e.target)) {
            menu.classList.add('hidden');
        }
    });

    function visitorLockButtonHtml() {
        return `
          <button type="button" onclick="App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')" class="btn-visitor-lock w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <span>Entrar para Apostar</span>
          </button>
        `;
    }

    return {
        get isLoggedIn() { return Boolean(currentUser); },
        get currentGame() { return currentGame; },
        requireAuth,
        showToast,
        formatCpfInput,
        fillValidSampleCpf,
        openAuthModal,
        closeAuthModal,
        setAuthMode,
        handleRegister,
        handleLogin,
        loginDemoAccount,
        logout,
        syncAuthStateUI,
        getBetAmount,
        placeBet,
        settleWin,
        recordGameBet,
        renderRecentBets,
        navigateTo,
        openGame,
        adjustBet,
        setMaxBet,
        onBetInputChange,
        openWallet,
        switchWalletTab,
        setDepositAmount,
        generatePixCharge,
        copyPixCode,
        confirmPixDeposit,
        resetPixForm,
        setMaxWithdraw,
        processWithdraw,
        handleChangePassword,
        promptResetBalance,
        cancelResetBalance,
        confirmResetBalance,
        toggleMobileMenu,
        closeMobileMenu,
        toggleUserDropdown,
        closeUserDropdown,
        visitorLockButtonHtml,
    };
})();

/* =========================================================================
   4. GAME 1: CRASH (~96% RTP Exponential Curve)
   ========================================================================= */
const CrashGame = (() => {
    let status = 'idle'; // 'idle' | 'running' | 'cashed' | 'crashed'
    let bet = 0;
    let currentMult = 1.00;
    let crashPoint = 1.00;
    let startTime = 0;
    let rafId = null;
    const history = [2.41, 1.18, 6.85, 1.00, 3.12, 1.74];

    function generateCrashPoint() {
        const r = Math.random();
        if (r < 0.04) return 1.00;
        const point = 0.96 / (1 - r);
        return Math.min(1000, Math.max(1.01, Math.floor(point * 100) / 100));
    }

    function init() {
        renderHistory();
        document.getElementById('gameSpecificControls').innerHTML = `
          <div>
            <label for="crashAutoCashout" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Auto-Retirar (Opcional)</label>
            <div class="flex items-center bg-[#060a13] border border-blue-500/20 focus-within:border-blue-500 rounded-xl px-3">
              <input id="crashAutoCashout" type="number" min="1.10" max="1000" step="0.10" placeholder="Ex: 2.00" class="w-full bg-transparent py-2.5 font-mono text-sm font-bold text-white focus:outline-none" />
              <span class="font-mono text-xs font-bold text-slate-500">x</span>
            </div>
          </div>
        `;
        updateActionBtn();
        resize();
    }

    function renderHistory() {
        const bar = document.getElementById('crashHistoryBar');
        if (!bar) return;
        bar.innerHTML = history.map(m => {
            const high = m >= 2.0;
            return `<span class="px-2.5 py-1 rounded-lg font-mono text-xs font-bold shrink-0 ${high ? 'bg-blue-500/15 border border-blue-500/30 text-cyan-300' : 'bg-[#060a13] border border-blue-500/15 text-slate-400'
                }">${formatMult(m)}</span>`;
        }).join('');
    }

    function updateActionBtn() {
        const area = document.getElementById('gameActionArea');
        if (!area) return;
        if (!App.isLoggedIn) {
            area.innerHTML = App.visitorLockButtonHtml();
            return;
        }
        if (status === 'running') {
            area.innerHTML = `
            <button type="button" onclick="CrashGame.cashout()" class="btn-cashout w-full py-4 rounded-xl font-extrabold text-base tracking-wide">
              Retirar ${formatBRL(bet * currentMult)}
            </button>
          `;
        } else {
            area.innerHTML = `
            <button type="button" onclick="CrashGame.start()" class="btn-primary w-full py-4 rounded-xl font-bold text-base">
              Apostar
            </button>
          `;
        }
    }

    function start() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (status === 'running') return;

        const amount = App.getBetAmount();
        if (!App.placeBet(amount)) return;

        bet = amount;
        currentMult = 1.00;
        crashPoint = generateCrashPoint();
        status = 'running';
        startTime = performance.now();

        SoundFX.play('click');

        const multEl = document.getElementById('crashMultiplierText');
        const subEl = document.getElementById('crashStatusSubtext');
        multEl.className = 'font-mono text-5xl sm:text-7xl font-extrabold text-white tracking-tight tabular-nums';
        subEl.textContent = 'Multiplicador em ascensão';
        subEl.className = 'mt-2 px-3.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-xs font-semibold text-cyan-300';

        updateActionBtn();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(loop);
    }

    function loop(now) {
        if (status !== 'running') return;
        const elapsedSec = (now - startTime) / 1000;
        const nextMult = Math.pow(Math.E, 0.115 * elapsedSec);
        currentMult = Math.floor(nextMult * 100) / 100;

        const autoInput = document.getElementById('crashAutoCashout');
        const autoTarget = autoInput ? parseFloat(autoInput.value) : NaN;

        if (Number.isFinite(autoTarget) && autoTarget >= 1.05 && currentMult >= autoTarget && autoTarget <= crashPoint) {
            currentMult = autoTarget;
            cashout();
            return;
        }

        if (currentMult >= crashPoint) {
            currentMult = crashPoint;
            status = 'crashed';
            finish(false);
            return;
        }

        document.getElementById('crashMultiplierText').textContent = formatMult(currentMult);
        updateActionBtn();
        draw();
        rafId = requestAnimationFrame(loop);
    }

    function cashout() {
        if (status !== 'running') return;
        status = 'cashed';
        if (rafId) cancelAnimationFrame(rafId);
        finish(true);
    }

    function finish(didWin) {
        const multEl = document.getElementById('crashMultiplierText');
        const subEl = document.getElementById('crashStatusSubtext');

        if (didWin) {
            const payout = Math.round(bet * currentMult * 100) / 100;
            App.settleWin(payout, currentMult);
            multEl.textContent = formatMult(currentMult);
            multEl.className = 'font-mono text-5xl sm:text-7xl font-extrabold text-emerald-400 tracking-tight tabular-nums';
            subEl.textContent = `Retirado: ${formatBRL(payout)}`;
            subEl.className = 'mt-2 px-3.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-semibold text-emerald-300';

            SoundFX.play('win');
            App.showToast(`Retirada no Crash: ${formatBRL(payout)} (${formatMult(currentMult)}).`, 'success');
            App.recordGameBet('Crash', bet, currentMult, payout);
        } else {
            multEl.textContent = formatMult(crashPoint);
            multEl.className = 'font-mono text-5xl sm:text-7xl font-extrabold text-red-500 tracking-tight tabular-nums';
            subEl.textContent = `Interrompido em ${formatMult(crashPoint)}`;
            subEl.className = 'mt-2 px-3.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-xs font-semibold text-red-300';

            SoundFX.play('loss');
            App.recordGameBet('Crash', bet, 0, 0);
        }

        history.unshift(crashPoint);
        if (history.length > 8) history.pop();
        renderHistory();
        updateActionBtn();
        draw();
    }

    function resize() {
        const wrap = document.getElementById('crashCanvasWrap');
        const canvas = document.getElementById('crashCanvas');
        if (!wrap || !canvas || wrap.offsetParent === null) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = wrap.clientWidth * dpr;
        canvas.height = wrap.clientHeight * dpr;
        draw();
    }

    function draw() {
        const canvas = document.getElementById('crashCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = (h / 5) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }
        for (let j = 1; j < 6; j++) {
            const x = (w / 6) * j;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
        }

        if (status === 'idle') return;

        const padX = w * 0.06;
        const padY = h * 0.12;
        const usableW = w - padX * 2;
        const usableH = h - padY * 2;

        const progress = Math.min(1, Math.log(currentMult) / Math.log(8));
        const endX = padX + usableW * Math.max(0.08, progress);
        const endY = h - padY - usableH * Math.pow(progress, 0.85);

        const isCrashed = status === 'crashed';
        const isCashed = status === 'cashed';
        const strokeColor = isCrashed ? '#ef4444' : isCashed ? '#10b981' : '#38bdf8';

        const grad = ctx.createLinearGradient(0, endY, 0, h - padY);
        grad.addColorStop(0, isCrashed ? 'rgba(239,68,68,0.22)' : isCashed ? 'rgba(16,185,129,0.22)' : 'rgba(56,189,248,0.24)');
        grad.addColorStop(1, 'rgba(6,10,19,0)');

        ctx.beginPath();
        ctx.moveTo(padX, h - padY);
        ctx.quadraticCurveTo(padX + (endX - padX) * 0.55, h - padY, endX, endY);
        ctx.lineTo(endX, h - padY);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(padX, h - padY);
        ctx.quadraticCurveTo(padX + (endX - padX) * 0.55, h - padY, endX, endY);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = Math.max(3, w * 0.0045);
        ctx.lineCap = 'round';
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(endX, endY, Math.max(5, w * 0.007), 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
    }

    return { init, start, cashout, updateActionBtn, resize };
})();

/* =========================================================================
   5. GAME 2: MINES (5x5 Grid, ~97% RTP, Zero Win Percentages)
   ========================================================================= */
const MinesGame = (() => {
    let active = false;
    let bet = 0;
    let minesCount = 3;
    let minePositions = new Set();
    let revealed = new Set();
    let currentMult = 1.00;

    function calcMultiplier(mCount, gemsFound) {
        if (gemsFound <= 0) return 1.00;
        let prob = 1;
        for (let i = 0; i < gemsFound; i++) {
            prob *= (25 - mCount - i) / (25 - i);
        }
        return Math.max(1.01, Math.floor((0.97 / prob) * 100) / 100);
    }

    function init() {
        let opts = '';
        for (let m = 1; m <= 24; m++) {
            opts += `<option value="${m}" ${m === minesCount ? 'selected' : ''}>${m} ${m === 1 ? 'Mina' : 'Minas'}</option>`;
        }

        document.getElementById('gameSpecificControls').innerHTML = `
          <div>
            <label for="minesCountSelect" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Quantidade de Minas</label>
            <select id="minesCountSelect" onchange="MinesGame.setMinesCount(this.value)" ${active ? 'disabled' : ''} class="w-full px-4 py-3 rounded-xl bg-[#060a13] border border-blue-500/20 focus:border-blue-500 focus:outline-none text-sm font-semibold text-white">
              ${opts}
            </select>
          </div>
          <div class="aether-subpanel p-3 flex items-center justify-between text-xs">
            <span class="text-slate-400">Próxima Gema</span>
            <span id="minesNextMultPreview" class="font-mono font-bold text-cyan-400">${formatMult(calcMultiplier(minesCount, 1))}</span>
          </div>
        `;

        renderBoard(false);
        updateUI();
    }

    function setMinesCount(val) {
        if (active) return;
        minesCount = parseInt(val, 10) || 3;
        SoundFX.play('click');
        updateUI();
    }

    function updateUI() {
        const stake = active ? bet : App.getBetAmount();
        const mult = active ? currentMult : 1.00;
        const nextMult = calcMultiplier(minesCount, revealed.size + 1);

        const curEl = document.getElementById('minesCurrentMult');
        const potEl = document.getElementById('minesPotentialWin');
        const nextEl = document.getElementById('minesNextMultPreview');
        const area = document.getElementById('gameActionArea');

        if (curEl) curEl.textContent = formatMult(mult);
        if (potEl) potEl.textContent = formatBRL(active ? stake * mult : 0);
        if (nextEl) nextEl.textContent = revealed.size < 25 - minesCount ? formatMult(nextMult) : 'Máximo';

        if (!area) return;
        if (!App.isLoggedIn) {
            area.innerHTML = App.visitorLockButtonHtml();
            return;
        }

        if (active) {
            const canCash = revealed.size > 0;
            area.innerHTML = `
            <button type="button" onclick="MinesGame.cashout()" ${canCash ? '' : 'disabled'} class="btn-cashout w-full py-4 rounded-xl font-extrabold text-base">
              ${canCash ? `Retirar ${formatBRL(stake * mult)}` : 'Selecione um bloco'}
            </button>
          `;
        } else {
            area.innerHTML = `
            <button type="button" onclick="MinesGame.start()" class="btn-primary w-full py-4 rounded-xl font-bold text-base">
              Iniciar Rodada
            </button>
          `;
        }
    }

    function start() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (active) return;

        const amount = App.getBetAmount();
        if (!App.placeBet(amount)) return;

        active = true;
        bet = amount;
        revealed = new Set();
        currentMult = 1.00;
        minePositions = new Set();

        while (minePositions.size < minesCount) {
            minePositions.add(Math.floor(Math.random() * 25));
        }

        const sel = document.getElementById('minesCountSelect');
        if (sel) sel.disabled = true;

        SoundFX.play('click');
        renderBoard(false);
        updateUI();
    }

    function pickTile(idx) {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (!active || revealed.has(idx)) return;
        revealed.add(idx);

        if (minePositions.has(idx)) {
            active = false;
            const sel = document.getElementById('minesCountSelect');
            if (sel) sel.disabled = false;

            SoundFX.play('loss');
            const board = document.getElementById('minesBoard');
            board.classList.add('animate-shake');
            setTimeout(() => board.classList.remove('animate-shake'), 380);

            renderBoard(true);
            updateUI();
            App.recordGameBet('Mines', bet, 0, 0);
            App.showToast('Mina atingida. Fim da rodada.', 'error');
        } else {
            const gems = revealed.size;
            currentMult = calcMultiplier(minesCount, gems);
            SoundFX.play('gem', gems);

            if (gems >= 25 - minesCount) {
                cashout();
            } else {
                renderBoard(false);
                updateUI();
            }
        }
    }

    function cashout() {
        if (!active || revealed.size === 0) return;
        active = false;
        const sel = document.getElementById('minesCountSelect');
        if (sel) sel.disabled = false;

        const payout = Math.round(bet * currentMult * 100) / 100;
        App.settleWin(payout, currentMult);
        SoundFX.play('win');
        renderBoard(true);
        updateUI();
        App.recordGameBet('Mines', bet, currentMult, payout);
        App.showToast(`Retirada no Mines: ${formatBRL(payout)} (${formatMult(currentMult)}).`, 'success');
    }

    function renderBoard(revealAll) {
        const board = document.getElementById('minesBoard');
        if (!board) return;

        let html = '';
        for (let i = 0; i < 25; i++) {
            const isRev = revealed.has(i) || revealAll;
            const isMine = minePositions.has(i);
            const wasPicked = revealed.has(i);

            let backHtml = '';
            if (isMine) {
                backHtml = `
              <div class="mine-back ${wasPicked ? 'bg-red-500/25 border-2 border-red-500' : 'bg-[#090f1d] border border-red-500/25 opacity-60'}">
                <svg class="w-6 h-6 sm:w-7 sm:h-7 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="5"></circle>
                  <line x1="12" y1="2" x2="12" y2="5"></line>
                  <line x1="12" y1="19" x2="12" y2="22"></line>
                  <line x1="2" y1="12" x2="5" y2="12"></line>
                  <line x1="19" y1="12" x2="22" y2="12"></line>
                  <line x1="4.93" y1="4.93" x2="7.05" y2="7.05"></line>
                  <line x1="16.95" y1="16.95" x2="19.07" y2="19.07"></line>
                  <line x1="19.07" y1="4.93" x2="16.95" y2="7.05"></line>
                  <line x1="7.05" y1="16.95" x2="4.93" y2="19.07"></line>
                </svg>
              </div>
            `;
            } else {
                backHtml = `
              <div class="mine-back ${wasPicked ? 'bg-cyan-500/20 border-2 border-cyan-400 shadow-[0_0_16px_rgba(56,189,248,0.28)]' : 'bg-[#0b1324] border border-cyan-500/20 opacity-55'}">
                <svg class="w-6 h-6 sm:w-7 sm:h-7 text-cyan-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 21 9 12 22 3 9 12 2"></polygon>
                  <polyline points="3 9 12 12 21 9"></polyline>
                  <line x1="12" y1="2" x2="12" y2="22"></line>
                </svg>
              </div>
            `;
            }

            html += `
            <button type="button" onclick="MinesGame.pickTile(${i})" class="mine-tile ${isRev ? 'revealed' : ''} ${!active ? 'disabled cursor-default' : 'cursor-pointer'} focus:outline-none">
              <div class="mine-tile-inner">
                <div class="mine-front">
                  <div class="w-2 h-2 rounded-full bg-blue-500/30"></div>
                </div>
                ${backHtml}
              </div>
            </button>
          `;
        }
        board.innerHTML = html;
    }

    return { init, setMinesCount, updateUI, start, pickTile, cashout };
})();

/* =========================================================================
   6. GAME 3: TOWER (8 Floors, Fácil = 4 cols, Médio = 3 cols, Difícil = 2 cols)
   ========================================================================= */
const TowerGame = (() => {
    // Fácil = 4 tiles/floor (1 bomb, 3 safe)
    // Médio = 3 tiles/floor (1 bomb, 2 safe)
    // Difícil = 2 tiles/floor (1 bomb, 1 safe)
    const DIFFS = {
        easy: { label: 'Fácil', cols: 4, safe: 3 },
        medium: { label: 'Médio', cols: 3, safe: 2 },
        hard: { label: 'Difícil', cols: 2, safe: 1 },
    };

    let active = false;
    let bet = 0;
    let difficulty = 'easy';
    let currentFloor = 0; // 0..8
    let floors = [];

    function getFloorMultiplier(diff, floorNum1Based) {
        const cfg = DIFFS[diff];
        const stepProb = cfg.safe / cfg.cols;
        return Math.floor((0.97 / Math.pow(stepProb, floorNum1Based)) * 100) / 100;
    }

    function buildEmptyFloors() {
        const cfg = DIFFS[difficulty];
        floors = Array.from({ length: 8 }, () => ({
            bombCol: -1,
            pickedCol: null,
            status: 'pending',
            cols: cfg.cols,
        }));
    }

    function init() {
        document.getElementById('gameSpecificControls').innerHTML = `
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Dificuldade</label>
            <div class="grid grid-cols-3 gap-2">
              ${Object.entries(DIFFS).map(([k, v]) => `
                <button type="button" onclick="TowerGame.setDifficulty('${k}')" ${active ? 'disabled' : ''} class="py-2.5 rounded-xl text-xs font-bold border transition-colors ${difficulty === k ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#060a13] border-blue-500/20 text-slate-400 hover:text-white'
            }">${v.label}</button>
              `).join('')}
            </div>
          </div>
        `;

        if (!active && floors.length === 0) buildEmptyFloors();
        renderGrid();
        updateUI();
    }

    function setDifficulty(diff) {
        if (active) return;
        difficulty = diff;
        SoundFX.play('click');
        buildEmptyFloors();
        init();
    }

    function start() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (active) return;

        const amount = App.getBetAmount();
        if (!App.placeBet(amount)) return;

        const cfg = DIFFS[difficulty];
        active = true;
        bet = amount;
        currentFloor = 0;

        floors = Array.from({ length: 8 }, () => ({
            bombCol: Math.floor(Math.random() * cfg.cols),
            pickedCol: null,
            status: 'pending',
            cols: cfg.cols,
        }));

        SoundFX.play('click');
        init();
    }

    function pickTile(floorIdx, colIdx) {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (!active || floorIdx !== currentFloor) return;

        const floor = floors[floorIdx];
        floor.pickedCol = colIdx;

        if (colIdx !== floor.bombCol) {
            floor.status = 'cleared';
            currentFloor += 1;
            SoundFX.play('gem', currentFloor + 1);

            if (currentFloor >= 8) {
                cashout();
                return;
            }
            renderGrid();
            updateUI();
        } else {
            floor.status = 'failed';
            active = false;
            SoundFX.play('loss');
            const grid = document.getElementById('towerGrid');
            grid.classList.add('animate-shake');
            setTimeout(() => grid.classList.remove('animate-shake'), 380);

            init();
            App.recordGameBet('Tower', bet, 0, 0);
            App.showToast('Você encontrou uma bomba na torre.', 'error');
        }
    }

    function cashout() {
        if (!active || currentFloor === 0) return;
        const mult = getFloorMultiplier(difficulty, currentFloor);
        const payout = Math.round(bet * mult * 100) / 100;

        active = false;
        App.settleWin(payout, mult);
        SoundFX.play('win');
        init();
        App.recordGameBet('Tower', bet, mult, payout);
        App.showToast(`Retirada no ${currentFloor}º andar: ${formatBRL(payout)} (${formatMult(mult)}).`, 'success');
    }

    function updateUI() {
        const floorLabel = document.getElementById('towerFloorLabel');
        const potEl = document.getElementById('towerPotentialWin');
        const area = document.getElementById('gameActionArea');

        const mult = currentFloor > 0 ? getFloorMultiplier(difficulty, currentFloor) : 0;
        const payout = bet * mult;

        if (floorLabel) floorLabel.textContent = `${currentFloor} / 8`;
        if (potEl) potEl.textContent = formatBRL(payout);

        if (!area) return;
        if (!App.isLoggedIn) {
            area.innerHTML = App.visitorLockButtonHtml();
            return;
        }

        if (active) {
            const canCash = currentFloor > 0;
            area.innerHTML = `
            <button type="button" onclick="TowerGame.cashout()" ${canCash ? '' : 'disabled'} class="btn-cashout w-full py-4 rounded-xl font-extrabold text-base">
              ${canCash ? `Retirar ${formatBRL(payout)}` : 'Escolha um bloco no 1º andar'}
            </button>
          `;
        } else {
            area.innerHTML = `
            <button type="button" onclick="TowerGame.start()" class="btn-primary w-full py-4 rounded-xl font-bold text-base">
              Iniciar Escalada
            </button>
          `;
        }
    }

    function renderGrid() {
        const grid = document.getElementById('towerGrid');
        if (!grid) return;

        let html = '';
        for (let idx = 7; idx >= 0; idx--) {
            const floor = floors[idx];
            const floorNum = idx + 1;
            const mult = getFloorMultiplier(difficulty, floorNum);
            const isCurrentActive = active && currentFloor === idx;
            const isRevealedRow = floor.status === 'cleared' || floor.status === 'failed' || (!active && floor.bombCol !== -1);

            const gridColsClass = floor.cols === 4 ? 'grid-cols-4' : floor.cols === 3 ? 'grid-cols-3' : 'grid-cols-2';
            let colsHtml = '';

            for (let c = 0; c < floor.cols; c++) {
                const isPicked = floor.pickedCol === c;
                const isBomb = c === floor.bombCol;

                let tileClass = 'bg-[#0f182b] border-blue-500/15 text-slate-600';
                let iconHtml = `<span class="w-1.5 h-1.5 rounded-full bg-slate-700"></span>`;

                if (isCurrentActive) {
                    tileClass = 'bg-[#152442] border-cyan-400/70 hover:bg-blue-600/30 hover:border-cyan-300 cursor-pointer active-floor-glow';
                    iconHtml = `<svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="18 15 12 9 6 15"></polyline></svg>`;
                } else if (isRevealedRow) {
                    if (!isBomb) {
                        tileClass = isPicked
                            ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                            : 'bg-cyan-500/10 border-cyan-500/25 text-cyan-400/65';
                        iconHtml = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
                    } else {
                        tileClass = isPicked
                            ? 'bg-red-500/25 border-red-500 text-red-400'
                            : 'bg-[#090f1d] border-blue-500/15 text-slate-700';
                        iconHtml = `<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;
                    }
                }

                colsHtml += `
              <button type="button" onclick="TowerGame.pickTile(${idx}, ${c})" ${isCurrentActive ? '' : 'disabled'} class="h-9 sm:h-10 rounded-lg border flex items-center justify-center transition-all ${tileClass}">
                ${iconHtml}
              </button>
            `;
            }

            html += `
            <div class="flex items-center gap-2.5">
              <div class="w-16 shrink-0 text-right font-mono text-xs font-bold ${isCurrentActive ? 'text-cyan-400' : floor.status === 'cleared' ? 'text-emerald-400' : 'text-slate-500'}">
                ${formatMult(mult)}
              </div>
              <div class="flex-1 grid ${gridColsClass} gap-2">
                ${colsHtml}
              </div>
            </div>
          `;
        }
        grid.innerHTML = html;
    }

    return { init, setDifficulty, start, pickTile, cashout, updateUI };
})();

/* =========================================================================
   7. GAME 4: DICE (Slider 2..98, ~97% RTP, ZERO Win Percentage Shown)
   ========================================================================= */
const DiceGame = (() => {
    let target = 50;
    let rollOver = true;
    const history = [64.12, 23.80, 81.05, 48.90, 91.34];

    function getMultiplier() {
        const span = rollOver ? (100 - target) : target;
        const safeSpan = Math.max(2, Math.min(98, span));
        return Math.floor((97 / safeSpan) * 100) / 100;
    }

    function init() {
        document.getElementById('gameSpecificControls').innerHTML = `
          <div class="space-y-3">
            <div>
              <label for="diceMultInput" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Multiplicador</label>
              <div class="flex items-center bg-[#060a13] border border-blue-500/20 focus-within:border-blue-500 rounded-xl px-3">
                <input id="diceMultInput" type="number" min="1.05" max="48.50" step="0.05" value="${getMultiplier().toFixed(2)}" onchange="DiceGame.onMultiplierInput(this.value)" class="w-full bg-transparent py-2.5 font-mono text-sm font-bold text-white focus:outline-none" />
                <span class="font-mono text-xs font-bold text-slate-500">x</span>
              </div>
            </div>

            <button type="button" onclick="DiceGame.toggleMode()" class="w-full py-2.5 px-3.5 rounded-xl bg-[#060a13] border border-blue-500/20 hover:border-blue-500/60 flex items-center justify-between text-xs font-semibold text-slate-200 transition-colors">
              <span id="diceModeSwitchText">${rollOver ? 'Modo: Rolar Acima' : 'Modo: Rolar Abaixo'}</span>
              <svg class="w-4 h-4 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>
            </button>
          </div>
        `;

        renderHistory();
        updateUI();
    }

    function onSliderChange(val) {
        target = Math.max(2, Math.min(98, parseInt(val, 10) || 50));
        updateUI();
    }

    function onMultiplierInput(val) {
        const m = Math.max(1.05, Math.min(48.50, parseFloat(val) || 1.94));
        const span = Math.max(2, Math.min(98, Math.round(97 / m)));
        target = rollOver ? (100 - span) : span;
        const slider = document.getElementById('diceRangeSlider');
        if (slider) slider.value = target;
        updateUI();
    }

    function toggleMode() {
        SoundFX.play('click');
        rollOver = !rollOver;
        target = 100 - target;
        const slider = document.getElementById('diceRangeSlider');
        if (slider) slider.value = target;
        const label = document.getElementById('diceModeSwitchText');
        if (label) label.textContent = rollOver ? 'Modo: Rolar Acima' : 'Modo: Rolar Abaixo';
        updateUI();
    }

    function updateUI() {
        const slider = document.getElementById('diceRangeSlider');
        if (slider) {
            const pct = ((target - 2) / 96) * 100;
            if (rollOver) {
                slider.style.background = `linear-gradient(to right, #ef4444 0%, #ef4444 ${pct}%, #2563eb ${pct}%, #38bdf8 100%)`;
            } else {
                slider.style.background = `linear-gradient(to right, #38bdf8 0%, #2563eb ${pct}%, #ef4444 ${pct}%, #ef4444 100%)`;
            }
        }

        const mult = getMultiplier();
        const bet = App.getBetAmount();
        const multInput = document.getElementById('diceMultInput');
        if (multInput && document.activeElement !== multInput) {
            multInput.value = mult.toFixed(2);
        }

        document.getElementById('diceBottomMult').textContent = formatMult(mult);
        document.getElementById('diceBottomModeLabel').textContent = rollOver ? 'Rolar Acima' : 'Rolar Abaixo';
        document.getElementById('diceBottomTarget').textContent = target.toFixed(2);
        document.getElementById('diceBottomPayout').textContent = formatBRL(bet * mult);

        const area = document.getElementById('gameActionArea');
        if (!area) return;
        area.innerHTML = App.isLoggedIn
            ? `<button type="button" onclick="DiceGame.roll()" class="btn-primary w-full py-4 rounded-xl font-bold text-base">Rolar Dado</button>`
            : App.visitorLockButtonHtml();
    }

    function roll() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        const bet = App.getBetAmount();
        if (!App.placeBet(bet)) return;

        const rolled = Math.floor(Math.random() * 10001) / 100;
        const won = rollOver ? rolled > target : rolled < target;
        const mult = getMultiplier();
        const payout = won ? Math.round(bet * mult * 100) / 100 : 0;

        if (won) {
            App.settleWin(payout, mult);
            SoundFX.play('win');
        } else {
            SoundFX.play('loss');
        }

        const numEl = document.getElementById('diceResultNumber');
        numEl.textContent = rolled.toFixed(2);
        numEl.className = `font-mono text-5xl sm:text-6xl font-extrabold mt-1 tabular-nums ${won ? 'text-emerald-400' : 'text-red-500'}`;

        const pin = document.getElementById('dicePin');
        const pinLabel = document.getElementById('dicePinLabel');
        pin.style.left = `${Math.max(3, Math.min(97, rolled))}%`;
        pinLabel.textContent = rolled.toFixed(2);
        pinLabel.className = `px-2 py-0.5 rounded bg-[#131d33] border font-mono text-xs font-bold shadow ${won ? 'border-emerald-400 text-emerald-300' : 'border-red-500 text-red-300'
            }`;

        history.unshift(rolled);
        if (history.length > 8) history.pop();
        renderHistory();
        App.recordGameBet('Dice', bet, mult, payout);
    }

    function renderHistory() {
        const bar = document.getElementById('diceHistoryBar');
        if (!bar) return;
        bar.innerHTML = history.map(r => `
          <span class="px-2.5 py-1 rounded-lg bg-[#060a13] border border-blue-500/15 font-mono text-xs font-semibold text-slate-300 shrink-0">
            ${r.toFixed(2)}
          </span>
        `).join('');
    }

    return { init, onSliderChange, onMultiplierInput, toggleMode, updateUI, roll };
})();

/* =========================================================================
   8. GAME 5: PLINKO (8, 12, 16 Rows, Baixo/Médio/Alto, ~97% RTP)
   ========================================================================= */
const PlinkoGame = (() => {
    const MULTIPLIERS = {
        8: {
            low: [5.6, 2.1, 1.1, 1.0, 0.5, 1.0, 1.1, 2.1, 5.6],
            medium: [13, 3.0, 1.3, 0.7, 0.4, 0.7, 1.3, 3.0, 13],
            high: [29, 4.0, 1.5, 0.3, 0.2, 0.3, 1.5, 4.0, 29],
        },
        12: {
            low: [10, 3.0, 1.6, 1.4, 1.1, 1.0, 0.5, 1.0, 1.1, 1.4, 1.6, 3.0, 10],
            medium: [33, 11, 4.0, 2.0, 1.1, 0.6, 0.3, 0.6, 1.1, 2.0, 4.0, 11, 33],
            high: [170, 24, 8.1, 2.0, 0.7, 0.2, 0.2, 0.2, 0.7, 2.0, 8.1, 24, 170],
        },
        16: {
            low: [16, 9, 2, 1.4, 1.4, 1.2, 1.1, 1, 0.5, 1, 1.1, 1.2, 1.4, 1.4, 2, 9, 16],
            medium: [110, 41, 10, 5, 3, 1.5, 1, 0.5, 0.3, 0.5, 1, 1.5, 3, 5, 10, 41, 110],
            high: [1000, 130, 26, 9, 4, 2, 0.2, 0.2, 0.2, 0.2, 0.2, 2, 4, 9, 26, 130, 1000],
        }
    };

    let risk = 'medium';
    let rows = 12;
    let balls = [];
    const pegGlows = new Map();
    let bucketBounce = [];
    let rafId = null;

    function init() {
        document.getElementById('gameSpecificControls').innerHTML = `
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Risco</label>
              <div class="grid grid-cols-3 gap-2">
                ${[['low', 'Baixo'], ['medium', 'Médio'], ['high', 'Alto']].map(([k, lbl]) => `
                  <button type="button" onclick="PlinkoGame.setRisk('${k}')" class="py-2.5 rounded-xl text-xs font-bold border transition-colors ${risk === k ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#060a13] border-blue-500/20 text-slate-400 hover:text-white'
            }">${lbl}</button>
                `).join('')}
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Linhas</label>
              <div class="grid grid-cols-3 gap-2">
                ${[8, 12, 16].map(r => `
                  <button type="button" onclick="PlinkoGame.setRows(${r})" class="py-2.5 rounded-xl font-mono text-xs font-bold border transition-colors ${rows === r ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#060a13] border-blue-500/20 text-slate-400 hover:text-white'
                }">${r}</button>
                `).join('')}
              </div>
            </div>
          </div>
        `;

        bucketBounce = new Array(rows + 1).fill(0);
        updateUI();
        resize();
        if (!rafId) rafId = requestAnimationFrame(loop);
    }

    function updateUI() {
        const area = document.getElementById('gameActionArea');
        if (!area) return;
        area.innerHTML = App.isLoggedIn
            ? `<button type="button" onclick="PlinkoGame.drop()" class="btn-primary w-full py-4 rounded-xl font-bold text-base">Lançar Esfera</button>`
            : App.visitorLockButtonHtml();
    }

    function setRisk(r) {
        SoundFX.play('click');
        risk = r;
        init();
    }

    function setRows(r) {
        SoundFX.play('click');
        rows = r;
        balls = [];
        init();
    }

    function drop() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        const bet = App.getBetAmount();
        if (!App.placeBet(bet)) return;

        SoundFX.play('click');
        const decisions = [];
        let slot = 0;
        for (let i = 0; i < rows; i++) {
            const dir = Math.random() < 0.5 ? 0 : 1;
            decisions.push(dir);
            slot += dir;
        }

        const mults = MULTIPLIERS[rows][risk];
        balls.push({
            bet,
            rows,
            decisions,
            slot,
            finalMult: mults[slot],
            progress: 0,
            speed: 0.14 + Math.random() * 0.015,
            lastRow: -1,
        });
    }

    function resize() {
        const wrap = document.getElementById('plinkoCanvasWrap');
        const canvas = document.getElementById('plinkoCanvas');
        if (!wrap || !canvas || wrap.offsetParent === null) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = wrap.clientWidth * dpr;
        canvas.height = wrap.clientHeight * dpr;
    }

    function loop() {
        const canvas = document.getElementById('plinkoCanvas');
        if (canvas && canvas.offsetParent !== null) {
            draw(canvas);
        }
        rafId = requestAnimationFrame(loop);
    }

    function draw(canvas) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const padTop = h * 0.09;
        const padBottom = h * 0.14;
        const usableH = h - padTop - padBottom;
        const rowSpacing = usableH / rows;
        const maxColsBottom = rows + 2;
        const colSpacing = Math.min((w * 0.88) / maxColsBottom, rowSpacing * 1.15);

        const getPeg = (r, c) => {
            const pins = r + 3;
            const rowW = (pins - 1) * colSpacing;
            return {
                x: (w - rowW) / 2 + c * colSpacing,
                y: padTop + r * rowSpacing,
            };
        };

        for (const [k, v] of pegGlows.entries()) {
            if (v <= 0.04) pegGlows.delete(k);
            else pegGlows.set(k, v * 0.91);
        }

        const pegR = Math.max(2.5, colSpacing * 0.11);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < r + 3; c++) {
                const { x, y } = getPeg(r, c);
                const glow = pegGlows.get(`${r}-${c}`) || 0;
                if (glow > 0) {
                    ctx.beginPath();
                    ctx.arc(x, y, pegR * (1.8 + glow * 1.4), 0, Math.PI * 2);
                    ctx.fillStyle = `rgba(56, 189, 248, ${glow * 0.35})`;
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(x, y, pegR, 0, Math.PI * 2);
                ctx.fillStyle = glow > 0.2 ? '#38bdf8' : '#334155';
                ctx.fill();
            }
        }

        const mults = MULTIPLIERS[rows][risk];
        const bCount = mults.length;
        const bucketY = padTop + rows * rowSpacing + rowSpacing * 0.35;
        const bucketH = Math.max(22, rowSpacing * 0.72);
        const totalBucketW = bCount * colSpacing;
        const bucketStartX = (w - totalBucketW) / 2;

        for (let b = 0; b < bCount; b++) {
            if (bucketBounce[b] > 0) {
                bucketBounce[b] *= 0.85;
                if (bucketBounce[b] < 0.1) bucketBounce[b] = 0;
            }
            const offY = bucketBounce[b] || 0;
            const bx = bucketStartX + b * colSpacing + 2;
            const bw = colSpacing - 4;
            const dist = Math.abs(b - (bCount - 1) / 2) / ((bCount - 1) / 2);

            ctx.fillStyle = dist > 0.72 ? '#2563eb' : dist > 0.35 ? '#1d4ed8' : '#131d33';
            ctx.strokeStyle = dist > 0.72 ? '#38bdf8' : 'rgba(59,130,246,0.35)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(bx, bucketY + offY, bw, bucketH, 6);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#f8fafc';
            ctx.font = `700 ${Math.max(9, Math.min(12, bw * 0.34))}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${mults[b]}x`, bx + bw / 2, bucketY + offY + bucketH / 2);
        }

        for (let i = balls.length - 1; i >= 0; i--) {
            const ball = balls[i];
            ball.progress += ball.speed;

            const curRow = Math.min(rows - 1, Math.floor(ball.progress));
            const frac = ball.progress - Math.floor(ball.progress);

            let colAtRow = 1;
            for (let s = 0; s < curRow; s++) colAtRow += ball.decisions[s];

            if (curRow !== ball.lastRow && ball.progress < rows) {
                ball.lastRow = curRow;
                pegGlows.set(`${curRow}-${colAtRow}`, 1.0);
                SoundFX.play('peg', curRow + colAtRow);
            }

            const startPos = getPeg(curRow, colAtRow);
            const nextCol = colAtRow + (ball.decisions[curRow] || 0);
            const endPos = curRow + 1 < rows
                ? getPeg(curRow + 1, nextCol)
                : { x: bucketStartX + (ball.slot + 0.5) * colSpacing, y: bucketY };

            const bx = startPos.x + (endPos.x - startPos.x) * frac;
            const arc = Math.sin(frac * Math.PI) * (rowSpacing * 0.28);
            const by = startPos.y + (endPos.y - startPos.y) * frac - arc;

            ctx.beginPath();
            ctx.arc(bx, by, pegR * 1.65, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            if (ball.progress >= rows) {
                bucketBounce[ball.slot] = 7;
                const payout = Math.round(ball.bet * ball.finalMult * 100) / 100;
                if (payout > 0) App.settleWin(payout, ball.finalMult);
                if (ball.finalMult >= 2) SoundFX.play('win');
                App.recordGameBet('Plinko', ball.bet, ball.finalMult, payout);
                balls.splice(i, 1);
            }
        }
    }

    return { init, setRisk, setRows, drop, updateUI, resize };
})();

/* =========================================================================
   9. GAME 6: DOUBLE (15 Tiles: 7 Vermelho 2x, 7 Preto 2x, 1 Branco 14x)
   ========================================================================= */
const DoubleGame = (() => {
    const PATTERN = [
        { color: 'white', label: '14x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
        { color: 'red', label: '2x' },
        { color: 'black', label: '2x' },
    ];

    let selectedColor = 'red';
    let spinning = false;
    const history = ['red', 'black', 'red', 'white', 'black', 'red', 'black', 'red'];

    function init() {
        document.getElementById('gameSpecificControls').innerHTML = `
          <div>
            <label class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Selecionar Cor</label>
            <div class="grid grid-cols-3 gap-2">
              <button type="button" onclick="DoubleGame.selectColor('red')" class="py-3 px-2 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border-2 transition-all ${selectedColor === 'red'
                ? 'bg-red-600 border-cyan-300 text-white shadow-lg shadow-red-600/30'
                : 'bg-red-600/80 border-transparent text-white/90 hover:opacity-100'
            }">
                <span>Vermelho</span>
                <span class="font-mono text-xs opacity-90">2x</span>
              </button>

              <button type="button" onclick="DoubleGame.selectColor('white')" class="py-3 px-2 rounded-xl font-extrabold text-xs flex flex-col items-center gap-1 border-2 transition-all ${selectedColor === 'white'
                ? 'bg-slate-50 border-cyan-400 text-[#060a13] shadow-lg'
                : 'bg-slate-200 border-transparent text-[#060a13] hover:bg-white'
            }">
                <span>Branco</span>
                <span class="font-mono text-xs">14x</span>
              </button>

              <button type="button" onclick="DoubleGame.selectColor('black')" class="py-3 px-2 rounded-xl font-bold text-xs flex flex-col items-center gap-1 border-2 transition-all ${selectedColor === 'black'
                ? 'bg-[#090e1a] border-cyan-300 text-white shadow-lg'
                : 'bg-[#090e1a] border-blue-500/20 text-slate-300 hover:text-white'
            }">
                <span>Preto</span>
                <span class="font-mono text-xs opacity-90">2x</span>
              </button>
            </div>
          </div>
        `;

        renderTrack();
        renderHistory();
        updateUI();
    }

    function selectColor(color) {
        if (spinning) return;
        SoundFX.play('click');
        selectedColor = color;
        init();
    }

    function updateUI() {
        const area = document.getElementById('gameActionArea');
        if (!area) return;
        if (!App.isLoggedIn) {
            area.innerHTML = App.visitorLockButtonHtml();
            return;
        }
        area.innerHTML = `
          <button id="spinDoubleBtn" type="button" onclick="DoubleGame.spin()" ${spinning ? 'disabled' : ''} class="btn-primary w-full py-4 rounded-xl font-bold text-base">
            ${spinning ? 'Girando...' : 'Girar Roleta'}
          </button>
        `;
    }

    function renderTrack() {
        const track = document.getElementById('doubleTrack');
        if (!track) return;

        let html = '';
        for (let rep = 0; rep < 6; rep++) {
            for (const tile of PATTERN) {
                if (tile.color === 'white') {
                    html += `
                <div class="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-b from-white to-slate-200 border-2 border-cyan-300 shrink-0 flex flex-col items-center justify-center text-[#060a13] shadow-lg">
                  <svg class="w-7 h-7 text-blue-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14"></path>
                  </svg>
                  <span class="font-mono text-xs font-extrabold mt-1">14x</span>
                </div>
              `;
                } else if (tile.color === 'red') {
                    html += `
                <div class="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-b from-red-500 to-red-700 border border-red-400/50 shrink-0 flex flex-col items-center justify-center text-white shadow-md">
                  <div class="w-6 h-6 rounded-full border-2 border-white/40 flex items-center justify-center">
                    <div class="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                  <span class="font-mono text-xs font-bold mt-1.5">2x</span>
                </div>
              `;
                } else {
                    html += `
                <div class="w-20 h-24 sm:w-24 sm:h-28 rounded-xl bg-gradient-to-b from-[#131d33] to-[#080d1a] border border-blue-500/20 shrink-0 flex flex-col items-center justify-center text-slate-300">
                  <div class="w-6 h-6 rounded-full border-2 border-slate-600 flex items-center justify-center">
                    <div class="w-2 h-2 rounded-full bg-slate-500"></div>
                  </div>
                  <span class="font-mono text-xs font-bold mt-1.5">2x</span>
                </div>
              `;
                }
            }
        }
        track.innerHTML = html;
        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';
    }

    function spin() {
        if (!App.requireAuth('Crie sua conta gratuita ou faça login para começar a apostar.')) return;
        if (spinning) return;

        const bet = App.getBetAmount();
        if (!App.placeBet(bet)) return;

        spinning = true;
        updateUI();
        SoundFX.play('click');

        const statusBar = document.getElementById('doubleStatusBar');
        if (statusBar) statusBar.textContent = 'Roleta em movimento...';

        const winIdx = Math.floor(Math.random() * 15);
        const winTile = PATTERN[winIdx];
        const targetTileIndex = 60 + winIdx;

        const track = document.getElementById('doubleTrack');
        const container = track.parentElement;
        const firstCard = track.children[0];
        const cardW = firstCard ? firstCard.offsetWidth : 96;
        const step = cardW + 10;
        const jitter = (Math.random() - 0.5) * (cardW * 0.45);
        const offset = targetTileIndex * step + cardW / 2 - container.clientWidth / 2 + jitter;

        track.style.transition = 'none';
        track.style.transform = 'translateX(0px)';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                track.style.transition = 'transform 3.4s cubic-bezier(0.12, 0.85, 0.22, 1)';
                track.style.transform = `translateX(-${offset}px)`;
            });
        });

        setTimeout(() => {
            spinning = false;
            updateUI();

            const won = winTile.color === selectedColor;
            const mult = winTile.color === 'white' ? 14 : 2;
            const payout = won ? Math.round(bet * mult * 100) / 100 : 0;

            const colorNames = { red: 'Vermelho (2x)', white: 'Branco (14x)', black: 'Preto (2x)' };
            if (statusBar) {
                statusBar.textContent = `Resultado: ${colorNames[winTile.color]}`;
            }

            if (won) {
                App.settleWin(payout, mult);
                SoundFX.play('win');
                App.showToast(`Vitória no Double (${colorNames[winTile.color]}): ${formatBRL(payout)}.`, 'success');
            } else {
                SoundFX.play('loss');
            }

            App.recordGameBet('Double', bet, mult, payout);
            history.unshift(winTile.color);
            if (history.length > 10) history.pop();
            renderHistory();
        }, 3550);
    }

    function renderHistory() {
        const bar = document.getElementById('doubleHistoryBar');
        if (!bar) return;
        bar.innerHTML = history.map(c => {
            if (c === 'white') {
                return `<span class="w-6 h-6 rounded-md bg-white text-[#060a13] font-mono text-[10px] font-extrabold flex items-center justify-center shrink-0">14</span>`;
            } else if (c === 'red') {
                return `<span class="w-6 h-6 rounded-md bg-red-600 text-white font-mono text-[10px] font-bold flex items-center justify-center shrink-0">2</span>`;
            } else {
                return `<span class="w-6 h-6 rounded-md bg-[#131d33] border border-blue-500/25 text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">2</span>`;
            }
        }).join('');
    }

    return { init, selectColor, updateUI, spin };
})();

/* =========================================================================
   10. INITIALIZATION ON WINDOW LOAD
   ========================================================================= */
window.addEventListener('resize', () => {
    CrashGame.resize();
    PlinkoGame.resize();
});

window.addEventListener('DOMContentLoaded', () => {
    SoundFX.updateIcon();
    App.syncAuthStateUI();
    App.renderRecentBets();
    App.navigateTo('home');
});
