const express = require('express');
const axios = require('axios');
const { createHttpsProxyAgent } = require('https-proxy-agent');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Optional: Put a free proxy address here if Discord returns '429 Too Many Requests'
const PROXY_URL = process.env.DISCORD_PROXY_IP || ''; 
const agent = PROXY_URL ? createHttpsProxyAgent(PROXY_URL) : null;

// Catch-all route to forward everything to Discord
app.all('*', async (req, res) => {
    // FIX: Safely formats the URL so it never smashes text together
    const cleanUrl = req.url.startsWith('/') ? req.url : `/${req.url}`;
    const discordUrl = `https://discord.com{cleanUrl}`;
    
    try {
        const response = await axios({
            method: req.method,
            url: discordUrl,
            headers: {
                ...req.headers,
                host: 'discord.com' // Rewrite host header for Discord
            },
            data: req.body,
            httpsAgent: agent,
            proxy: false 
        });
        
        res.status(response.status).json(response.data);
    } catch (error) {
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: 'Proxy failed to reach Discord', details: error.message });
        }
    }
});

app.listen(PORT, () => {
    console.log(`Discord proxy running on port ${PORT}`);
    
    // Self-ping loop to stop Render from spinning down
    const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL;
    if (RENDER_EXTERNAL_URL) {
        setInterval(() => {
            axios.get(RENDER_EXTERNAL_URL)
                .then(() => console.log('Self-ping successful: Staying awake!'))
                .catch((err) => console.error('Self-ping failed:', err.message));
        }, 10 * 60 * 1000); // Pings every 10 minutes
    }
});
