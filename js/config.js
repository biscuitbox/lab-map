// ① Firebase 콘솔 → 프로젝트 설정 → 내 앱(웹)에서 복사한 값을 붙여 넣으세요.
//    이 값은 공개되어도 괜찮아요. 데이터는 firestore.rules가 지켜요.
export const firebaseConfig = {
  apiKey: "AIzaSyD1oCq5wuM7lMco_E5HZyZO-3h3SAresFc",
  authDomain: "haeyeon-lab-map.firebaseapp.com",
  projectId: "haeyeon-lab-map",
  storageBucket: "haeyeon-lab-map.firebasestorage.app",
  messagingSenderId: "868708628207",
  appId: "1:868708628207:web:e21f277f36dcbc9fbb8d1a"
};

// ② 처음부터 관리자인 구글 계정. firestore.rules의 firstAdmins()와 똑같이 적어 주세요.
//    관리자는 다른 선생님을 승인하고, 다른 사람을 관리자로 바꿀 수 있어요.
export const ADMIN_EMAILS = [
  "biscuittong@gmail.com"
];

// 사이트 큰 제목의 처음 값. 사이트 안에서 관리자가 눌러서 바꿀 수 있어요.
export const SITE_TITLE = "과학실 실험장 지도";

// ③ QR 라벨이 가리킬 주소. 비워 두면 지금 접속한 주소를 써요.
//    예: "https://아이디.github.io/lab-map/"
export const SITE_URL = "";

// ④ 승인 없이 '구글로 로그인한 사람 누구나' 쓰게 하려면 true로 바꾸고,
//    firestore.rules의 isMember() 안을 `return signedIn();` 으로 바꿔 주세요.
//    (true면 구글 계정만 있으면 누구나 들어올 수 있으니 학교 밖 사람도 볼 수 있어요.)
export const OPEN_TO_ALL_GOOGLE = false;
