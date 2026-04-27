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

export default defineAgent({
  entry: async (ctx) => {
    const roomName = ctx.room.name;
    console.log(`🚀 Joining room: ${roomName}`);

    // 🔌 Connect to LiveKit first
    await ctx.connect();
    console.log(`✅ Connected to LiveKit`);

    // 🎤 Create AI session
    const session = new voice.AgentSession({
      llm: new google.realtime.RealtimeModel({
        model: "gemini-2.0-flash-exp",
        voice: "Puck",
        temperature: 0.7,
      }),
      turnHandling: {
        interruptions: true,
      },
    });

    // 🔗 Start session
    await session.start({
      agent: new MyAgent(),
      room: ctx.room,
    });

    console.log(`🤖 Agent ready in room: ${roomName}`);

    // 📩 Listen for frontend messages
    ctx.room.on("dataReceived", async (payload, participant) => {
      try {
        const text = new TextDecoder().decode(payload);
        const data = JSON.parse(text);

        if (data.type === "message" && data.text) {
          console.log(`📩 ${participant?.identity}: ${data.text}`);

          const handle = session.generateReply({
            instructions: `
You are FalconGPT, a friendly and human-like AI voice assistant.

Style:
- Warm, natural, conversational
- Not robotic
- Slightly casual but clear
- Keep responses short and engaging

Always respond like you're speaking to a real person.

User said:
"${data.text}"

Now respond naturally:
`
          });

          await handle.waitForPlayout();
        }

      } catch (err) {
        console.error("❌ Message error:", err);
      }
    });

    // 📡 Notify frontend that agent is ready
    await ctx.room.localParticipant.publishData(
      new TextEncoder().encode(JSON.stringify({
        type: 'agent_ready',
        status: 'ready'
      }))
    );

    // 👋 Initial greeting
    setTimeout(async () => {
      try {
        const greet = session.generateReply({
          instructions: `
You are FalconGPT, a friendly AI voice assistant.

Greet the user warmly and naturally.
Introduce yourself briefly and ask how you can help.

Keep it short and human-like.
`
        });

        await greet.waitForPlayout();
      } catch (err) {
        console.error("Greeting error:", err);
      }
    }, 3000);
  },
});

// 🤖 Agent class
class MyAgent {
  constructor() {
    console.log("🤖 Agent initialized");
  }
}

// 🚀 Run agent
cli.runApp(
  new ServerOptions({
    agent: fileURLToPath(import.meta.url),
    agentName: 'falcon-gpt-agent',
  })
);
