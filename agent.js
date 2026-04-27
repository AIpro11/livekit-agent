import {
  defineAgent,
  cli,
  voice,
  ServerOptions,
} from '@livekit/agents';

import * as google from '@livekit/agents-plugin-google';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

dotenv.config();

// Store credentials per room
const roomCredentials = new Map();

// 🚀 Define agent
export default defineAgent({
  entry: async (ctx) => {
    const roomName = ctx.room.name;
    console.log(`🚀 Joining room: ${roomName}`);

    let session = null;
    let currentLLM = null;

    // Function to create LLM instance (no API key needed for Gemini - uses LiveKit Inference)
    function createLLM() {
      return new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp",
        voice: "Puck",
        apiKey: undefined, // LiveKit Inference handles this automatically
        temperature: 0.7,
      });
    }

    // Create initial session
    currentLLM = createLLM();
    session = new voice.AgentSession({
      llm: currentLLM,
      turnHandling: { interruptions: true },
    });

    await session.start({
      agent: new MyAgent(),
      room: ctx.room,
    });

    await ctx.connect();
    console.log(`✅ Agent connected to room: ${roomName}`);

    // Listen for messages from frontend
    ctx.room.on("dataReceived", async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        // Handle credential update (store for reference, but agent doesn't need them for Gemini)
        if (data.type === 'credentials') {
          console.log(`🔑 Credentials received from ${participant?.identity}`);
          roomCredentials.set(roomName, {
            apiKey: data.apiKey,
            apiSecret: data.apiSecret,
            wsUrl: data.wsUrl
          });
          
          // Send confirmation
          await ctx.room.localParticipant.publishData(
            new TextEncoder().encode(JSON.stringify({ 
              type: 'credential_status', 
              status: 'ok',
              message: 'Agent ready'
            }))
          );
          return;
        }

        // Handle chat messages
        if (data.type === 'message' && data.text && session) {
          console.log(`📩 ${participant?.identity}: ${data.text}`);
          const handle = session.generateReply({ instructions: data.text });
          await handle.waitForPlayout();
        }

      } catch (err) {
        console.error("❌ Error:", err);
      }
    });

    // Send ready signal to frontend
    await ctx.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({ 
        type: 'agent_ready', 
        status: 'ready',
        message: 'Voice agent is ready to chat'
      }))
    );

    // Auto greeting
    setTimeout(async () => {
      try {
        if (session) {
          const greet = session.generateReply({
            instructions: "Hello! I'm your AI voice assistant. How can I help you today? Feel free to speak or type your message.",
          });
          await greet.waitForPlayout();
        }
      } catch (err) {
        console.error("Greeting error:", err);
      }
    }, 3000);
  },
});

// 🤖 Agent class
class MyAgent {
  constructor() {
    console.log("🤖 Agent initialized and ready");
  }
}

// 🧩 Run agent
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'falcon-gpt-agent',
  })
);

// 🔥 Keep process alive for Render (prevents idle shutdown)
setInterval(() => {
  console.log("🤖 Agent still alive...");
}, 60000);

// Handle process signals for graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Log uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
