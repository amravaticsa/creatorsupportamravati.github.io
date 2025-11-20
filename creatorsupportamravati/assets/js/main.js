document.addEventListener('DOMContentLoaded', function(){
  const form = document.getElementById('booking-form');
  const payBtn = document.getElementById('pay-button');

  payBtn && payBtn.addEventListener('click', function(){
    alert('Payment placeholder clicked. Integrate Razorpay/Instamojo checkout here.');
  });

  form && form.addEventListener('submit', function(e){
    e.preventDefault();
    // collect form data
    const data = {};
    new FormData(form).forEach((v,k)=> {
      if (data[k] === undefined) data[k] = v;
      else if (Array.isArray(data[k])) data[k].push(v);
      else data[k] = [data[k], v];
    });
    // For now just show the data and indicate to check email record
    console.log('Booking data:', data);
    alert('Booking submitted. We will contact you soon. (This is a demo placeholder.)');
    form.reset();
  });
});
