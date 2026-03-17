// assets/js/script.js

// FIREBASE CONFIGURATION
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// LIKE FUNCTION
function likePost(postId, btn){
    let ref = db.collection("posts").doc(postId);

    ref.get().then((doc) => {
        if(doc.exists){
            let count = doc.data().likes || 0;
            count++;
            ref.update({likes: count});
            btn.querySelector("span").innerText = count;
        } else {
            ref.set({likes:1});
            btn.querySelector("span").innerText = 1;
        }
    });
}

// SHARE FUNCTION
function sharePost(){
    if(navigator.share){
        navigator.share({
            title: document.title,
            url: window.location.href
        });
    } else {
        window.open(`https://wa.me/?text=${window.location.href}`);
    }
}

// ADD COMMENT FUNCTION
function addComment(postId){
    let input = document.getElementById(`commentInput-${postId}`);
    let text = input.value;

    if(text === "") return;

    db.collection("comments").add({
        postId: postId,
        text: text,
        time: new Date()
    });

    input.value = "";
}

// LOAD COMMENTS FUNCTION
function loadComments(postId){
    db.collection("comments")
      .where("postId", "==", postId)
      .orderBy("time", "desc")
      .onSnapshot((snapshot) => {
          let html = "";
          snapshot.forEach(doc => {
              html += `<p>💬 ${doc.data().text}</p>`;
          });
          document.getElementById(`comments-${postId}`).innerHTML = html;
      });
}

// LOAD LIKES ON PAGE LOAD
function loadLikes(postId){
    let ref = db.collection("posts").doc(postId);

    ref.get().then((doc) => {
        if(doc.exists){
            document.querySelector(`[onclick*="${postId}"] span`).innerText = doc.data().likes || 0;
        }
    });
}

// INITIALIZE FUNCTIONS FOR POSTS
// Example: for post with id 'post1'
loadComments('post1');
loadLikes('post1');
// LIKE SYSTEM
function likePost(postId, btn){
  let ref = db.collection("posts").doc(postId);

  ref.get().then((doc)=>{
    if(doc.exists){
      let count = doc.data().likes || 0;
      count++;
      ref.update({likes: count});
      btn.querySelector("span").innerText = count;
    } else {
      ref.set({likes:1});
      btn.querySelector("span").innerText = 1;
    }
  });
}


// SHARE SYSTEM
function sharePost(){
  if(navigator.share){
    navigator.share({
      title: document.title,
      url: window.location.href
    });
  } else {
    window.open(`https://wa.me/?text=${window.location.href}`);
  }
}


// ADD COMMENT
function addComment(postId){
  let input = document.getElementById(`commentInput-${postId}`);
  let text = input.value;

  if(text==="") return;

  db.collection("comments").add({
    postId: postId,
    text: text,
    time: new Date()
  });

  input.value="";
}


// LOAD COMMENTS (REAL-TIME)
function loadComments(postId){
  db.collection("comments")
    .where("postId","==",postId)
    .orderBy("time","desc")
    .onSnapshot((snapshot)=>{
      let html="";
      snapshot.forEach(doc=>{
        html += `<p>💬 ${doc.data().text}</p>`;
      });

      document.getElementById(`comments-${postId}`).innerHTML = html;
    });
}


// LOAD LIKES ON PAGE LOAD
function loadLikes(postId){
  let ref = db.collection("posts").doc(postId);

  ref.get().then((doc)=>{
    if(doc.exists){
      document.querySelector(`[onclick*=\"${postId}\"] span`).innerText = doc.data().likes || 0;
    }
  });
}


// INIT (IMPORTANT)
loadComments("post1");
loadLikes("post1");
