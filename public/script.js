// ambil element dari HTML
const form = document.getElementById('chat-form');
const input = document.getElementById('user-input');
const chatBox = document.getElementById('chat-box');
const submitBtn = form.querySelector('button');

// konfigurasi marked.js — aktifkan syntax highlighting otomatis
marked.setOptions({
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  },
  breaks: true,   // newline jadi <br>
  gfm: true       // GitHub Flavored Markdown
});

// array untuk menyimpan history percakapan
// format: [{ role: "user", text: "..." }, { role: "model", text: "..." }]
let conversation = [];

// ketika form di-submit
form.addEventListener('submit', async function (e) {
  e.preventDefault();

  const userMessage = input.value.trim();
  if (!userMessage) return;

  // tampilkan pesan user di chat box
  appendUserMessage(userMessage);
  input.value = '';

  // simpan pesan user ke conversation history
  conversation.push({ role: 'user', text: userMessage });

  // disable tombol kirim supaya tidak spam
  submitBtn.disabled = true;

  // buat bubble bot dengan animasi loading
  const botMsg = createBotBubble();

  // teks lengkap yang akan terkumpul dari streaming
  let fullText = '';

  try {
    // kirim request ke endpoint streaming
    const response = await fetch('/chat-stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation })
    });

    // baca response sebagai stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // decode chunk dan tambahkan ke buffer
      buffer += decoder.decode(value, { stream: true });

      // proses setiap baris SSE yang sudah komplit
      const lines = buffer.split('\n');
      buffer = lines.pop(); // simpan baris terakhir yang mungkin belum komplit

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6).trim();
        if (data === '[DONE]') break;

        try {
          const parsed = JSON.parse(data);

          if (parsed.error) {
            botMsg.innerHTML = `<span style="color:red">Error: ${parsed.error}</span>`;
            return;
          }

          if (parsed.text) {
            fullText += parsed.text;
            // render markdown secara real-time saat tiap chunk datang
            botMsg.innerHTML = marked.parse(fullText);
            // auto scroll ke bawah
            chatBox.scrollTop = chatBox.scrollHeight;
          }
        } catch (parseErr) {
          // abaikan jika bukan JSON valid
        }
      }
    }

    // simpan balasan lengkap ke conversation history
    conversation.push({ role: 'model', text: fullText });

  } catch (error) {
    botMsg.innerHTML = '<span style="color:red">Gagal menghubungi server. Pastikan backend sudah jalan!</span>';
    console.error('Error:', error);
  }

  // enable kembali tombol kirim
  submitBtn.disabled = false;
  input.focus();
});

// buat bubble pesan user
function appendUserMessage(text) {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message-wrapper', 'user-wrapper');

  const msg = document.createElement('div');
  msg.classList.add('message', 'user');
  msg.textContent = text;

  wrapper.appendChild(msg);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// buat bubble bot kosong (akan diisi secara streaming)
function createBotBubble() {
  const wrapper = document.createElement('div');
  wrapper.classList.add('message-wrapper', 'bot-wrapper');

  const msg = document.createElement('div');
  msg.classList.add('message', 'bot');
  msg.innerHTML = '<span class="cursor">▍</span>'; // kursor animasi

  wrapper.appendChild(msg);
  chatBox.appendChild(wrapper);
  chatBox.scrollTop = chatBox.scrollHeight;
  return msg;
}

