
const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '../../data/users.json');

class AuthService {
    constructor() {
        this.users = {};
        this.loadUsers();
    }

    loadUsers() {
        try {
            if (fs.existsSync(USERS_FILE)) {
                this.users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
            }
        } catch (e) {
            console.error('Error loading users:', e);
            this.users = {};
        }
    }

    saveUsers() {
        try {
            fs.writeFileSync(USERS_FILE, JSON.stringify(this.users, null, 2));
        } catch (e) {
            console.error('Error saving users:', e);
        }
    }

    register(email, username, password) {
        if (this.users[username] || Object.values(this.users).find(u => u.email === email)) {
            return { success: false, message: 'User or Email already exists' };
        }

        // Simple "hashing" for now (In prod, use bcrypt)
        const newUser = {
            id: Date.now().toString(), // Simple ID
            email,
            username,
            password, // TODO: Hash this
            character: {
                color: '#00ff00', // Default Green
                skin: null
            },
            createdAt: Date.now()
        };

        this.users[username] = newUser;
        this.saveUsers();
        return { success: true, user: this.sanitize(newUser) };
    }

    login(username, password) {
        const user = this.users[username];
        if (user && user.password === password) {
            return { success: true, user: this.sanitize(user) };
        }
        return { success: false, message: 'Invalid credentials' };
    }

    updateCharacter(username, characterData) {
        const user = this.users[username];
        if (user) {
            user.character = { ...user.character, ...characterData };
            this.saveUsers();
            return { success: true, user: this.sanitize(user) };
        }
        return { success: false, message: 'User not found' };
    }

    sanitize(user) {
        const { password, ...safeUser } = user;
        return safeUser;
    }

    getUser(username) {
        return this.users[username];
    }
}

module.exports = new AuthService();
