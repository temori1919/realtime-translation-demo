<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import SiriWave from 'siriwave';
// 音声区間検知用のライブラリ
import { MicVAD, utils } from '@ricky0123/vad-web'

const selectedOption = ref<string>('');
const isChecked = ref<boolean>(false);
// textでoutputできる言語は以下を参照。
// @see https://huggingface.co/facebook/hf-seamless-m4t-large/blob/main/generation_config.json#L48-L145
const LANGS = ['afr','amh','arb','ary','arz','asm','azj','bel','ben','bos','bul','cat','ceb','ces','ckb','cmn','cmn_Hant','cym','dan','deu','ell','eng','est','eus','fin','fra','fuv','gaz','gle','glg','guj','heb','hin','hrv','hun','hye','ibo','ind','isl','ita','jav','jpn','kan','kat','kaz','khk','khm','kir','kor','lao','lit','lug','luo','lvs','mai','mal','mar','mkd','mlt','mni','mya','nld','nno','nob','npi','nya','ory','pan','pbt','pes','pol','por','ron','rus','sat','slk','slv','sna','snd','som','spa','srp','swe','swh','tam','tel','tgk','tgl','tha','tur','ukr','urd','uzn','vie','yor','yue','zlm','zul'];
// 翻訳した一文字あたりの表示時間
const READ_TIME_MS = 200;
// レスポンスの翻訳テキストを表示する累計時間
const readTimeAll = ref<number>(0);
const siri = ref<any>();
const myvad = ref<any>();

// レスポンスとして返される翻訳されたテキスト
const responseTextArr = ref<string[]>([]);

// スタックされたテキストの一番最初を表示する
const translated = computed(() => {
  return responseTextArr.value[0] || '';
});

const toggleWave = async (amplitude: number) => {
  await siri.value.setAmplitude(amplitude);
}

const translation = async (file: any) => {
  let formData = new FormData();
  formData.append('lang', selectedOption.value);
  formData.append('wav', file, 'request-translation-audio.wav');

  const url = `${import.meta.env.VITE_BASE_URL}/trans`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      'ngrok-skip-browser-warning': '1',
      // 'Content-Type': 'multipart/form-data' // fetchではContent-Typeの指定はできない、boundayをよしなに設定してくれなくなる
    },
    body: formData,
  })

  const response = resp.status;
  const text = response === 200 ? await resp.text() : 'SOME ERROR';
  responseTextArr.value.push(text);
  readTimeAll.value += text.length * READ_TIME_MS;

  // 文字の長さから表示時間を設定し、setTimeoutでスタック配列から削除する。
  setTimeout(() => {
    responseTextArr.value = responseTextArr.value.filter((item: string) => {
      return item != text;
    });
    readTimeAll.value -= text.length * READ_TIME_MS;
  }, readTimeAll.value);

  // ====================================================
  // debug用（生成したwavファイルをDLして内容を確認したい時用）
  // ====================================================

  // // FileオブジェクトからBlobオブジェクトを作成
  // const blob = new Blob([file], { type: file.type });

  // // Blobオブジェクトを含むURLを作成
  // const blobURL = URL.createObjectURL(blob);

  // // ダウンロードリンクを作成
  // const downloadLink = document.createElement("a");
  // downloadLink.href = blobURL;
  // downloadLink.download = file.name; // ファイル名を指定

  // // ダウンロードリンクをクリックしてダウンロードを開始
  // downloadLink.click();

  // // 使用後にURLを解放する
  // URL.revokeObjectURL(blobURL);
};

const makeVADInstance = async (onTranslate: (file: any) => void, onToggleWave: (amplitude: number) => void) => {
  return await MicVAD.new({
    onSpeechStart: () => {
      onToggleWave(1);
    },
    onSpeechEnd: (arr) => {
      onToggleWave(0);
      const wavBuffer = utils.encodeWAV(arr)
      const file = new File([wavBuffer], `audio.wav`);
      try {
        onTranslate(file);
      } catch (err) {
        console.log(err);
      }
    },
  });
}

const handelClick = async (e:any) => {
  try {
    // マイクがブロックされているか判定するためにstreamを取得する
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true});
    // 取得したstreamは使用しないので停止する
    stream.getTracks().forEach(function(track) {
      track.stop();
    });

    if (!selectedOption.value) {
      e.preventDefault();
      alert('言語が選択されていません。');
    } else {
      isChecked.value = !isChecked.value;
      if (isChecked.value) {
        myvad.value.start();
      } else {
        siri.value.setAmplitude(0);
        myvad.value.pause();
      }
    }
  } catch (err: any) {
    console.error(err);
    e.preventDefault();
    alert('マイクの使用が許可されていません。');
  }
};

onMounted(async () => {
  // amplitudeを1にして開始しないとreavtiveにならないので1 -> 0に変更している
  siri.value = new SiriWave({
    container: <HTMLElement>document.getElementById("siri-container"),
    width: 1020,
    height: 400,
    style: 'ios9',
    amplitude: 1
  });
  await siri.value.setAmplitude(0);
  myvad.value = await makeVADInstance(translation, toggleWave)
});
</script>

<template>
  <div>
    <select v-model="selectedOption" class="custom-select">
      <option value="" disabled selected hidden>言語を選択</option>
      <option v-for="(lang, index) in LANGS" :value="lang" :key="index">{{ lang }}</option>
    </select>
  </div>
  <div class="container">
    <div id="siri-container"></div>
    <span class="responce-text">{{ translated }}</span>
  </div>
  <div
    class="switch-checkbox"
    :class="{ 'switch-checkbox-checked' : isChecked }"
    @click="handelClick"
  >
    <input 
      type="checkbox" 
      :value="isChecked"
    />
  </div>
</template>

<style scoped>
.custom-select {
  position: fixed;
  width: 200px;
  padding: 10px;
  font-size: 16px;
  border: 1px solid #ccc;
  border-radius: 5px;
  background-color: #242424; /* 背景色に合わせる */
  color: #fff; /* テキスト色を白に設定 */
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  background-image: url('data:image/svg+xml;utf8,<svg fill="%23fff" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>'); /* アイコンの色を白に設定 */
  background-repeat: no-repeat;
  background-position: right 10px top 50%;
  margin-top: 1rem;
  margin-right: 1rem;
  right: 0;
}

.responce-text {
  font-size: 2rem;
  height: 2rem;;
}

.container {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    box-sizing: border-box;
    background-color: #242424;
    height: 100%;
}

.switch-checkbox {
    position: relative;
    z-index: 0;
    bottom: 15vh;
    float: right;
    margin-right: 5vh;
}

.switch-checkbox input[type=checkbox] {
    position: relative;
    cursor: pointer;
    width: 10vh;
    height: 10vh;
    border-radius: 50%;
    background: linear-gradient(145deg, #424242, #181818);
    box-shadow: 0 0px 8px #666;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    vertical-align: middle;
    transition: .2s;
}

.switch-checkbox input[type=checkbox]::before {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    color: #efefef;
    font-family: "Font Awesome 5 Free";
    font-size: 4vh;
    font-weight: 900;
    content: "\f130";
    transition: .2s;
}

.switch-checkbox input[type=checkbox]::after {
    position: absolute;
    top: -8px;
    right: -8px;
    bottom: -8px;
    left: -8px;
    border-radius: inherit;
    background: linear-gradient(#efefef, #cecece);
    z-index: -1;
    content: "";
    transition: .1s;
}

.switch-checkbox-checked input[type=checkbox] {
    background: linear-gradient(145deg, #181818, #424242);
}

.switch-checkbox-checked input[type=checkbox]::before {
    color: #19FF97;
    text-shadow: 0 0px 3px #1CD892;
}

.switch-checkbox-checked input[type=checkbox]::after {
    background-image: linear-gradient(135deg, #69FF97 10%, #00E4FF 100%);
    box-shadow: 0 0px 10px #69FF97;
}
</style>