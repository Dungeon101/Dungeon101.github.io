export const Auth = {
    USER_KEY: 'dungeon101_user',
    META_KEY: 'dungeon101_meta',

    isLoggedIn() {
        return !!localStorage.getItem(this.USER_KEY);
    },

    getUser() {
        return localStorage.getItem(this.USER_KEY);
    },

    login() {
        // Mocking Google Login
        // In a real app, this would use google.accounts.id.initialize() and prompt()
        const mockUser = 'user_' + Math.floor(Math.random() * 100000);
        localStorage.setItem(this.USER_KEY, mockUser);

        // Initialize default meta progression if new
        if (!localStorage.getItem(this.META_KEY)) {
            const initialMeta = {
                runs: 0,
                unlockedTalents: [],
                goldBank: 0,
                permamentStats: { str: 0, dex: 0, int: 0 }
            };
            localStorage.setItem(this.META_KEY, JSON.stringify(initialMeta));
        }

        return mockUser;
    },

    logout() {
        localStorage.removeItem(this.USER_KEY);
    },

    getMeta() {
        return JSON.parse(localStorage.getItem(this.META_KEY) || '{}');
    },

    saveMeta(metaData) {
        localStorage.setItem(this.META_KEY, JSON.stringify(metaData));
    }
};
