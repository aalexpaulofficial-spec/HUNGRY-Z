export type AssistantLanguage = "en" | "hi" | "kn";

type Topic = "features" | "fees" | "order" | "payment" | "event" | "cancel" | "refund" | "account" | "canteen" | "scanner" | "privacy" | "support";

const topicWords: Record<Topic, Record<AssistantLanguage, string[]>> = {
  features: {
    en: ["features", "what can hungry", "what does hungry", "what is hungry z", "website do"],
    hi: ["फीचर", "सुविधा", "हंग्री ज़ेड क्या", "हंग्री जेड क्या"],
    kn: ["ವೈಶಿಷ್ಟ್ಯ", "ಸೌಲಭ್ಯ", "ಹಂಗ್ರಿ ಝೆಡ್ ಏನು", "ಹಂಗ್ರಿ ಜಡ್ ಏನು"],
  },
  fees: {
    en: ["fee", "platform charge", "platform fee", "service charge"],
    hi: ["फीस", "शुल्क", "प्लेटफॉर्म चार्ज"],
    kn: ["ಶುಲ್ಕ", "ಫೀ", "ಪ್ಲಾಟ್‌ಫಾರ್ಮ್ ಶುಲ್ಕ"],
  },
  event: {
    en: ["event", "token", "faculty", "participant", "qr", "capacity"],
    hi: ["कार्यक्रम", "इवेंट", "टोकन", "फैकल्टी", "प्रतिभागी", "क्षमता", "क्यूआर"],
    kn: ["ಕಾರ್ಯಕ್ರಮ", "ಈವೆಂಟ್", "ಟೋಕನ್", "ಉಪನ್ಯಾಸಕ", "ಭಾಗವಹಿಸುವ", "ಸಾಮರ್ಥ್ಯ", "ಕ್ಯೂಆರ್"],
  },
  cancel: {
    en: ["cancel", "cancellation"],
    hi: ["रद्द", "कैंसल", "रद्द करना"],
    kn: ["ರದ್ದು", "ಕ್ಯಾನ್ಸಲ್", "ರದ್ದು ಮಾಡುವುದು"],
  },
  payment: {
    en: ["payment", "pay", "razorpay", "upi", "charged", "money", "deducted"],
    hi: ["पेमेंट", "भुगतान", "पैसे", "यूपीआई", "कट", "रिफंड"],
    kn: ["ಪಾವತಿ", "ಹಣ", "ಯುಪಿಐ", "ಕಡಿತ", "ರಿಫಂಡ್"],
  },
  refund: {
    en: ["refund"],
    hi: ["रिफंड", "पैसे वापस"],
    kn: ["ಮರುಪಾವತಿ", "ಹಣ ಹಿಂದಿರುಗಿ"],
  },
  order: {
    en: ["order", "food", "menu", "dine", "parcel", "pickup", "pick up", "code"],
    hi: ["ऑर्डर", "आर्डर", "खाना", "मेन्यू", "भोजन", "पिकअप", "कोड"],
    kn: ["ಆರ್ಡರ್", "ಆಹಾರ", "ಮೆನು", "ಊಟ", "ಪಾರ್ಸೆಲ್", "ಪಿಕಪ್", "ಕೋಡ್"],
  },
  account: {
    en: ["account", "login", "log in", "sign up", "register", "password", "google"],
    hi: ["अकाउंट", "खाता", "लॉगिन", "लॉग इन", "साइन अप", "पासवर्ड", "गूगल"],
    kn: ["ಖಾತೆ", "ಲಾಗಿನ್", "ಸೈನ್ ಅಪ್", "ನೋಂದಣಿ", "ಪಾಸ್‌ವರ್ಡ್", "ಗೂಗಲ್"],
  },
  canteen: {
    en: ["canteen", "owner", "register a canteen", "canteen code", "owner id"],
    hi: ["कैंटीन", "कैंटीन कोड", "मालिक", "रजिस्टर", "पंजीकृत"],
    kn: ["ಕ್ಯಾಂಟೀನ್", "ಕ್ಯಾಂಟೀನ್ ಕೋಡ್", "ಮಾಲೀಕ", "ನೋಂದಾಯ", "ನೋಂದಣಿ"],
  },
  scanner: {
    en: ["scan", "scanner", "nutrition", "calorie", "photo"],
    hi: ["स्कैन", "पोषण", "कैलोरी", "फोटो"],
    kn: ["ಸ್ಕ್ಯಾನ್", "ಪೌಷ್ಟಿಕಾಂಶ", "ಕ್ಯಾಲರಿ", "ಫೋಟೋ"],
  },
  privacy: {
    en: ["privacy", "terms", "data", "personal information"],
    hi: ["प्राइवेसी", "गोपनीयता", "नियम", "डेटा", "जानकारी"],
    kn: ["ಗೌಪ್ಯತೆ", "ನಿಯಮಗಳು", "ಡೇಟಾ", "ಮಾಹಿತಿ"],
  },
  support: {
    en: ["help", "support", "contact", "email", "problem", "issue"],
    hi: ["मदद", "सहायता", "संपर्क", "ईमेल", "समस्या"],
    kn: ["ಸಹಾಯ", "ಬೆಂಬಲ", "ಸಂಪರ್ಕ", "ಇಮೇಲ್", "ಸಮಸ್ಯೆ"],
  },
};

const answers: Record<Topic, Record<AssistantLanguage, string>> = {
  features: {
    en: "HUNGRY Z brings participating campus canteens online: users can browse live menus, order and track pickup, choose available payment methods, and request eligible refunds. Faculty can coordinate food for events, while eligible users can join published events with capacity-limited tokens. Canteen owners manage menus, order fulfilment and event serving. HUNGRY AI Scan provides an estimated food and nutrition lookup. The website help chat answers common questions locally.",
    hi: "HUNGRY Z में कैंपस कैंटीन के live menus देखना, खाना ऑर्डर और pickup track करना, उपलब्ध भुगतान चुनना और पात्र refund माँगना शामिल है। फैकल्टी कार्यक्रमों के लिए भोजन का समन्वय कर सकती है; पात्र उपयोगकर्ता प्रकाशित कार्यक्रम में क्षमता-सीमित token से भाग ले सकते हैं। कैंटीन मालिक menu, order और event serving संभालते हैं। HUNGRY AI Scan भोजन और nutrition का अनुमान देता है। वेबसाइट चैट सामान्य सवालों के जवाब यहीं देती है।",
    kn: "HUNGRY Z ಮೂಲಕ ಭಾಗವಹಿಸುವ ಕ್ಯಾಂಪಸ್ ಕ್ಯಾಂಟೀನ್‌ಗಳ live menu ನೋಡಬಹುದು, ಆಹಾರ ಆರ್ಡರ್ ಮಾಡಿ pickup ಸ್ಥಿತಿ ಪರಿಶೀಲಿಸಬಹುದು, ಲಭ್ಯ ಪಾವತಿ ಆಯ್ಕೆಮಾಡಬಹುದು ಮತ್ತು ಅರ್ಹ ಮರುಪಾವತಿ ಕೇಳಬಹುದು. ಉಪನ್ಯಾಸಕರು ಕಾರ್ಯಕ್ರಮದ ಆಹಾರವನ್ನು ಸಂಯೋಜಿಸಬಹುದು; ಅರ್ಹ ಬಳಕೆದಾರರು ಪ್ರಕಟಿತ ಕಾರ್ಯಕ್ರಮಕ್ಕೆ ಸಾಮರ್ಥ್ಯ-ಮಿತಿಯ token ಮೂಲಕ ಭಾಗವಹಿಸಬಹುದು. ಕ್ಯಾಂಟೀನ್ ಮಾಲೀಕರು menu, order ಮತ್ತು event serving ನಿರ್ವಹಿಸುತ್ತಾರೆ. HUNGRY AI Scan ಆಹಾರ ಮತ್ತು ಪೌಷ್ಟಿಕಾಂಶದ ಅಂದಾಜು ನೀಡುತ್ತದೆ. ವೆಬ್‌ಸೈಟ್ ಚಾಟ್ ಸಾಮಾನ್ಯ ಪ್ರಶ್ನೆಗಳಿಗೆ ಇಲ್ಲಿಯೇ ಉತ್ತರಿಸುತ್ತದೆ.",
  },
  fees: {
    en: "The website currently advertises a ₹0 HUNGRY Z platform fee per food order. The canteen's listed item prices and any clearly shown order charges still apply; review the checkout total before placing an order.",
    hi: "वेबसाइट पर हर food order के लिए HUNGRY Z platform fee ₹0 बताई गई है। कैंटीन के item prices और स्पष्ट रूप से दिखाए गए अन्य order charges लागू हो सकते हैं; ऑर्डर से पहले checkout total देखें।",
    kn: "ಪ್ರತಿ ಆಹಾರ ಆರ್ಡರ್‌ಗೆ HUNGRY Z platform fee ₹0 ಎಂದು ವೆಬ್‌ಸೈಟ್ ತಿಳಿಸುತ್ತದೆ. ಕ್ಯಾಂಟೀನ್‌ನ ಐಟಂ ಬೆಲೆಗಳು ಮತ್ತು ಸ್ಪಷ್ಟವಾಗಿ ತೋರಿಸಿದ ಇತರ order charges ಅನ್ವಯಿಸಬಹುದು; ಆರ್ಡರ್ ಮಾಡುವ ಮೊದಲು checkout total ಪರಿಶೀಲಿಸಿ.",
  },
  order: {
    en: "Sign in or create an account, enter your participating canteen's 7-character code, choose available food and quantities, then select Dine In or Parcel. Parcel is Pay at Counter; Dine In shows the payment options currently available. Track the order in Orders and show its 4-digit collection code at the listed counter when it is ready.",
    hi: "साइन इन करें या खाता बनाएँ, अपने कैंटीन का 7-अक्षर वाला कोड डालें, उपलब्ध खाना और मात्रा चुनें, फिर Dine In या Parcel चुनें। Parcel में काउंटर पर भुगतान होता है; Dine In में उपलब्ध भुगतान विकल्प दिखते हैं। ऑर्डर को Orders में देखें और तैयार होने पर बताए गए काउंटर पर 4-अंकों का कलेक्शन कोड दिखाएँ।",
    kn: "ಸೈನ್ ಇನ್ ಮಾಡಿ ಅಥವಾ ಖಾತೆ ತೆರೆಯಿರಿ, ನಿಮ್ಮ ಕ್ಯಾಂಟೀನ್‌ನ 7 ಅಕ್ಷರಗಳ ಕೋಡ್ ನಮೂದಿಸಿ, ಲಭ್ಯವಿರುವ ಆಹಾರ ಮತ್ತು ಪ್ರಮಾಣ ಆಯ್ಕೆಮಾಡಿ, ನಂತರ Dine In ಅಥವಾ Parcel ಆರಿಸಿ. Parcel ಗೆ ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿಸಬೇಕು; Dine In ನಲ್ಲಿ ಲಭ್ಯವಿರುವ ಪಾವತಿ ಆಯ್ಕೆಗಳು ಕಾಣುತ್ತವೆ. Orders ನಲ್ಲಿ ಸ್ಥಿತಿ ನೋಡಿ, ಸಿದ್ಧವಾದಾಗ ಸೂಚಿಸಿದ ಕೌಂಟರ್‌ನಲ್ಲಿ 4 ಅಂಕಿಯ ಸಂಗ್ರಹ ಕೋಡ್ ತೋರಿಸಿ.",
  },
  payment: {
    en: "Pay at Counter is available, and Dine In may also offer Razorpay online payment. Parcel currently requires Pay at Counter. Online payments count as paid only after HUNGRY Z verifies provider confirmation. If money was deducted but the order still looks unpaid, don't pay again; contact hungryofficialx@gmail.com with your Order ID and payment reference.",
    hi: "काउंटर पर भुगतान उपलब्ध है; Dine In में Razorpay ऑनलाइन भुगतान भी दिख सकता है। Parcel के लिए अभी काउंटर पर भुगतान ज़रूरी है। ऑनलाइन भुगतान को HUNGRY Z द्वारा प्रदाता की पुष्टि जाँचने के बाद ही Paid माना जाता है। पैसे कटे हों लेकिन ऑर्डर unpaid दिखे तो दोबारा भुगतान न करें; Order ID और भुगतान संदर्भ के साथ hungryofficialx@gmail.com पर लिखें।",
    kn: "ಕೌಂಟರ್‌ನಲ್ಲಿ ಪಾವತಿ ಲಭ್ಯವಿದೆ; Dine In ನಲ್ಲಿ Razorpay ಆನ್‌ಲೈನ್ ಪಾವತಿಯೂ ಕಾಣಬಹುದು. Parcel ಗೆ ಪ್ರಸ್ತುತ ಕೌಂಟರ್ ಪಾವತಿ ಅಗತ್ಯ. ಪಾವತಿ ಸೇವೆಯ ದೃಢೀಕರಣವನ್ನು HUNGRY Z ಪರಿಶೀಲಿಸಿದ ನಂತರವೇ ಆನ್‌ಲೈನ್ ಪಾವತಿ Paid ಆಗುತ್ತದೆ. ಹಣ ಕಡಿತವಾಗಿ ಆರ್ಡರ್ unpaid ಎಂದು ಕಂಡರೆ ಮತ್ತೆ ಪಾವತಿಸಬೇಡಿ; Order ID ಮತ್ತು ಪಾವತಿ ವಿವರಗಳೊಂದಿಗೆ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ.",
  },
  event: {
    en: "Faculty submit event details, expected participants, a 7-digit access code, food quantities and optional instructions. The canteen reviews the request and sends item prices and an estimated budget; faculty can request changes or approve. The canteen publishes after approval. Eligible signed-in users at that canteen enter the event code and generate one four-digit token with a QR code, while capacity remains. Event tokens are for participation and do not use the normal food cart or checkout.",
    hi: "फैकल्टी कार्यक्रम का विवरण, प्रतिभागियों की संख्या, 7-अंकों का कोड, खाने की मात्रा और वैकल्पिक निर्देश भेजते हैं। कैंटीन अनुरोध देखकर कीमतों और अनुमानित बजट का कोटेशन भेजती है; फैकल्टी बदलाव माँग सकती है या मंज़ूरी दे सकती है। मंज़ूरी के बाद कैंटीन कार्यक्रम प्रकाशित करती है। उस कैंटीन से जुड़े साइन-इन किए हुए पात्र उपयोगकर्ता कोड डालकर QR सहित एक 4-अंकों का टोकन बना सकते हैं, जब तक क्षमता उपलब्ध है। यह भागीदारी टोकन है; इसमें सामान्य फूड कार्ट या checkout नहीं होता।",
    kn: "ಉಪನ್ಯಾಸಕರು ಕಾರ್ಯಕ್ರಮದ ವಿವರ, ನಿರೀಕ್ಷಿತ ಭಾಗವಹಿಸುವವರ ಸಂಖ್ಯೆ, 7 ಅಂಕಿಯ ಪ್ರವೇಶ ಕೋಡ್, ಆಹಾರದ ಪ್ರಮಾಣ ಮತ್ತು ಐಚ್ಛಿಕ ಸೂಚನೆಗಳನ್ನು ಕಳುಹಿಸುತ್ತಾರೆ. ಕ್ಯಾಂಟೀನ್ ವಿನಂತಿಯನ್ನು ಪರಿಶೀಲಿಸಿ ಐಟಂ ಬೆಲೆಗಳು ಮತ್ತು ಅಂದಾಜು ಬಜೆಟ್ ಕಳುಹಿಸುತ್ತದೆ; ಉಪನ್ಯಾಸಕರು ಬದಲಾವಣೆ ಕೇಳಬಹುದು ಅಥವಾ ಅನುಮೋದಿಸಬಹುದು. ಅನುಮೋದನೆಯ ನಂತರ ಕ್ಯಾಂಟೀನ್ ಪ್ರಕಟಿಸುತ್ತದೆ. ಆ ಕ್ಯಾಂಟೀನ್‌ಗೆ ಸೇರಿದ ಸೈನ್-ಇನ್ ಮಾಡಿದ ಅರ್ಹ ಬಳಕೆದಾರರು ಕೋಡ್ ನಮೂದಿಸಿ QR ಹೊಂದಿರುವ ಒಂದು 4 ಅಂಕಿಯ ಟೋಕನ್ ಪಡೆಯಬಹುದು; ಸಾಮರ್ಥ್ಯ ಉಳಿದಿರಬೇಕು. ಇದು ಭಾಗವಹಿಸುವಿಕೆಯ ಟೋಕನ್; ಸಾಮಾನ್ಯ ಆಹಾರ ಕಾರ್ಟ್ ಅಥವಾ checkout ಬಳಸುವುದಿಲ್ಲ.",
  },
  cancel: {
    en: "An online order that is still awaiting payment may show a Cancel option in its order details. For an accepted or preparing order, contact the canteen or HUNGRY Z support; available cancellation depends on the order state and payment method. Email hungryofficialx@gmail.com with your Order ID if you need help.",
    hi: "भुगतान की प्रतीक्षा कर रहे online order के विवरण में Cancel विकल्प दिख सकता है। स्वीकार या तैयार हो रहे ऑर्डर के लिए कैंटीन या HUNGRY Z support से संपर्क करें; रद्द करना order की स्थिति और भुगतान तरीके पर निर्भर करता है। मदद के लिए Order ID के साथ hungryofficialx@gmail.com पर लिखें।",
    kn: "ಪಾವತಿಗಾಗಿ ಕಾಯುತ್ತಿರುವ online order ವಿವರಗಳಲ್ಲಿ Cancel ಆಯ್ಕೆ ಕಾಣಬಹುದು. ಸ್ವೀಕರಿಸಿದ ಅಥವಾ ತಯಾರಾಗುತ್ತಿರುವ ಆರ್ಡರ್‌ಗಾಗಿ ಕ್ಯಾಂಟೀನ್ ಅಥವಾ HUNGRY Z ಬೆಂಬಲವನ್ನು ಸಂಪರ್ಕಿಸಿ; ರದ್ದುಪಡಿಸುವುದು ಆರ್ಡರ್ ಸ್ಥಿತಿ ಮತ್ತು ಪಾವತಿ ವಿಧಾನವನ್ನು ಅವಲಂಬಿಸಿರುತ್ತದೆ. ಸಹಾಯಕ್ಕೆ Order ID ಜೊತೆಗೆ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ.",
  },
  refund: {
    en: "If an order shows a Request a refund option, submit a request from its details. Refunds are reviewed and cancellation does not automatically qualify. If approved, the refund is sent through Razorpay to the original payment method. Once approval is followed by successful refund initiation, eligible refunds generally take 5–7 business working days to appear; bank and payment-provider processing can vary. Check the refund status and amount in order details. HUNGRY Z emails you when a refund is initiated and when its status changes. A refund is shown as completed only after gateway confirmation. For help, email hungryofficialx@gmail.com with your Order ID.",
    hi: "यदि ऑर्डर विवरण में Request a refund विकल्प दिखे, तो वहीं से अनुरोध भेजें। रिफंड की समीक्षा होती है और केवल रद्द होने से रिफंड अपने-आप मंज़ूर नहीं होता। मंज़ूरी मिलने पर रिफंड Razorpay के माध्यम से मूल भुगतान तरीके पर भेजा जाता है। मंज़ूरी के बाद रिफंड सफलतापूर्वक शुरू होने पर, पात्र रिफंड आमतौर पर 5–7 व्यावसायिक कार्यदिवस में दिखाई देते हैं; बैंक और भुगतान सेवा के अनुसार समय बदल सकता है। ऑर्डर विवरण में रिफंड की स्थिति और राशि देखें। रिफंड शुरू होने और स्थिति बदलने पर HUNGRY Z ईमेल भेजता है। गेटवे की पुष्टि मिलने के बाद ही रिफंड को पूरा दिखाया जाता है। मदद के लिए Order ID के साथ hungryofficialx@gmail.com पर ईमेल करें।",
    kn: "ಆರ್ಡರ್ ವಿವರಗಳಲ್ಲಿ Request a refund ಆಯ್ಕೆ ಕಂಡರೆ ಅಲ್ಲಿಂದ ವಿನಂತಿ ಕಳುಹಿಸಿ. ವಿನಂತಿಯನ್ನು ಪರಿಶೀಲಿಸಲಾಗುತ್ತದೆ; ಆರ್ಡರ್ ರದ್ದಾದ ಮಾತ್ರಕ್ಕೆ ಮರುಪಾವತಿ ಸ್ವಯಂ ಅನುಮೋದನೆಯಾಗುವುದಿಲ್ಲ. ಅನುಮೋದಿಸಿದರೆ, ಮರುಪಾವತಿಯನ್ನು Razorpay ಮೂಲಕ ಮೂಲ ಪಾವತಿ ವಿಧಾನಕ್ಕೆ ಕಳುಹಿಸಲಾಗುತ್ತದೆ. ಅನುಮೋದನೆಯ ನಂತರ ಮರುಪಾವತಿ ಯಶಸ್ವಿಯಾಗಿ ಪ್ರಾರಂಭವಾದರೆ, ಅರ್ಹ ಮರುಪಾವತಿಗಳು ಸಾಮಾನ್ಯವಾಗಿ 5–7 ವ್ಯವಹಾರಿಕ ಕೆಲಸದ ದಿನಗಳಲ್ಲಿ ಕಾಣಿಸುತ್ತವೆ; ಬ್ಯಾಂಕ್ ಮತ್ತು ಪಾವತಿ ಸೇವೆಯ ಪ್ರಕ್ರಿಯೆಗೆ ಅನುಗುಣವಾಗಿ ಸಮಯ ಬದಲಾಗಬಹುದು. ಆರ್ಡರ್ ವಿವರಗಳಲ್ಲಿ ಮರುಪಾವತಿಯ ಸ್ಥಿತಿ ಮತ್ತು ಮೊತ್ತವನ್ನು ನೋಡಿ. ಮರುಪಾವತಿ ಪ್ರಾರಂಭವಾದಾಗ ಮತ್ತು ಸ್ಥಿತಿ ಬದಲಾದಾಗ HUNGRY Z ಇಮೇಲ್ ಕಳುಹಿಸುತ್ತದೆ. ಪಾವತಿ ಗೇಟ್‌ವೇ ದೃಢೀಕರಿಸಿದ ನಂತರವೇ ಮರುಪಾವತಿಯನ್ನು ಪೂರ್ಣವಾಗಿದೆ ಎಂದು ತೋರಿಸಲಾಗುತ್ತದೆ. ಸಹಾಯಕ್ಕೆ Order ID ಜೊತೆಗೆ hungryofficialx@gmail.com ಗೆ ಇಮೇಲ್ ಮಾಡಿ.",
  },
  account: {
    en: "Use Create Account or Login and enter accurate details. Customer accounts can be for students, faculty or guests. Google sign-in is optional when it is shown. Use your own account and keep passwords, one-time codes and canteen owner access details private.",
    hi: "Create Account या Login चुनकर सही जानकारी भरें। ग्राहक खाता student, faculty या guest के लिए हो सकता है। Google sign-in दिखे तो वह वैकल्पिक है। अपना ही खाता इस्तेमाल करें और पासवर्ड, one-time code तथा कैंटीन owner access विवरण निजी रखें।",
    kn: "Create Account ಅಥವಾ Login ಆಯ್ಕೆಮಾಡಿ ಸರಿಯಾದ ವಿವರಗಳನ್ನು ನಮೂದಿಸಿ. ಗ್ರಾಹಕ ಖಾತೆ student, faculty ಅಥವಾ guest ಗಾಗಿ ಇರಬಹುದು. Google sign-in ಕಾಣಿಸಿದರೆ ಅದು ಐಚ್ಛಿಕ. ನಿಮ್ಮದೇ ಖಾತೆ ಬಳಸಿ; ಪಾಸ್‌ವರ್ಡ್, one-time code ಮತ್ತು ಕ್ಯಾಂಟೀನ್ ಮಾಲೀಕರ ಪ್ರವೇಶ ವಿವರಗಳನ್ನು ರಹಸ್ಯವಾಗಿಡಿ.",
  },
  canteen: {
    en: "Canteen owners can use Register Your Canteen to submit institution, canteen, owner, business and supporting details for review. Approved canteens receive separate owner login details and a 7-character Canteen Code for customers. Contact hungryofficialx@gmail.com if you need help with an application.",
    hi: "कैंटीन मालिक Register Your Canteen से संस्थान, कैंटीन, मालिक, व्यवसाय और सहायक विवरण समीक्षा के लिए भेज सकते हैं। स्वीकृत कैंटीन को अलग owner login जानकारी और ग्राहकों के लिए 7-अक्षर का Canteen Code मिलता है। आवेदन सहायता के लिए hungryofficialx@gmail.com पर लिखें।",
    kn: "ಕ್ಯಾಂಟೀನ್ ಮಾಲೀಕರು Register Your Canteen ಮೂಲಕ ಸಂಸ್ಥೆ, ಕ್ಯಾಂಟೀನ್, ಮಾಲೀಕ, ವ್ಯವಹಾರ ಮತ್ತು ಸಹಾಯಕ ವಿವರಗಳನ್ನು ಪರಿಶೀಲನೆಗೆ ಕಳುಹಿಸಬಹುದು. ಅನುಮೋದಿತ ಕ್ಯಾಂಟೀನ್‌ಗಳಿಗೆ ಪ್ರತ್ಯೇಕ owner login ವಿವರಗಳು ಮತ್ತು ಗ್ರಾಹಕರಿಗಾಗಿ 7 ಅಕ್ಷರಗಳ Canteen Code ಸಿಗುತ್ತದೆ. ಅರ್ಜಿ ಸಹಾಯಕ್ಕೆ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ.",
  },
  scanner: {
    en: "HUNGRY AI Scan can identify food from a photo and request an estimated nutrition lookup. Results may be incomplete or inaccurate and are not medical, allergy or dietary advice. Check ingredients and allergy questions directly with the canteen.",
    hi: "HUNGRY AI Scan फोटो से भोजन पहचानकर अनुमानित nutrition जानकारी दिखा सकता है। परिणाम अधूरे या गलत हो सकते हैं; यह चिकित्सा, एलर्जी या आहार सलाह नहीं है। सामग्री और एलर्जी के बारे में कैंटीन से सीधे पूछें।",
    kn: "HUNGRY AI Scan ಫೋಟೋದಿಂದ ಆಹಾರ ಗುರುತಿಸಿ ಅಂದಾಜು ಪೌಷ್ಟಿಕಾಂಶ ಮಾಹಿತಿಯನ್ನು ಪಡೆಯಬಹುದು. ಫಲಿತಾಂಶಗಳು ಅಪೂರ್ಣ ಅಥವಾ ತಪ್ಪಾಗಿರಬಹುದು; ಇದು ವೈದ್ಯಕೀಯ, ಅಲರ್ಜಿ ಅಥವಾ ಆಹಾರ ಸಲಹೆಯಲ್ಲ. ಪದಾರ್ಥ ಮತ್ತು ಅಲರ್ಜಿ ಬಗ್ಗೆ ಕ್ಯಾಂಟೀನ್‌ನಿಂದಲೇ ಖಚಿತಪಡಿಸಿಕೊಳ್ಳಿ.",
  },
  privacy: {
    en: "The Privacy Policy and Terms & Conditions are available at hungryz.vercel.app from the website footer, sign-up flow and dashboard profile. The policy explains account, order, payment, support, scanner and event information. You can email privacy questions or requests to hungryofficialx@gmail.com.",
    hi: "Privacy Policy और Terms & Conditions hungryz.vercel.app पर website footer, sign-up और dashboard profile से उपलब्ध हैं। नीति में account, order, payment, support, scanner और event जानकारी समझाई गई है। गोपनीयता संबंधी सवाल या अनुरोध hungryofficialx@gmail.com पर भेजें।",
    kn: "Privacy Policy ಮತ್ತು Terms & Conditions hungryz.vercel.app ನಲ್ಲಿ website footer, sign-up ಮತ್ತು dashboard profile ಮೂಲಕ ಲಭ್ಯವಿವೆ. ನೀತಿಯಲ್ಲಿ account, order, payment, support, scanner ಮತ್ತು event ಮಾಹಿತಿಯನ್ನು ವಿವರಿಸಲಾಗಿದೆ. ಗೌಪ್ಯತೆ ಪ್ರಶ್ನೆ ಅಥವಾ ವಿನಂತಿಗಾಗಿ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ.",
  },
  support: {
    en: "For account, order, payment, refund, event or privacy help, email hungryofficialx@gmail.com. Include your Order ID and payment reference for payment problems. Never send a password, one-time code or full card details.",
    hi: "खाते, ऑर्डर, भुगतान, रिफंड, कार्यक्रम या गोपनीयता सहायता के लिए hungryofficialx@gmail.com पर लिखें। भुगतान समस्या में Order ID और payment reference दें। पासवर्ड, one-time code या पूरे कार्ड विवरण कभी न भेजें।",
    kn: "ಖಾತೆ, ಆರ್ಡರ್, ಪಾವತಿ, ಮರುಪಾವತಿ, ಕಾರ್ಯಕ್ರಮ ಅಥವಾ ಗೌಪ್ಯತೆ ಸಹಾಯಕ್ಕೆ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ. ಪಾವತಿ ಸಮಸ್ಯೆಗಳಿಗೆ Order ID ಮತ್ತು payment reference ಸೇರಿಸಿ. ಪಾಸ್‌ವರ್ಡ್, one-time code ಅಥವಾ ಪೂರ್ಣ ಕಾರ್ಡ್ ವಿವರಗಳನ್ನು ಕಳುಹಿಸಬೇಡಿ.",
  },
};

const fallback: Record<AssistantLanguage, string> = {
  en: "I can help with HUNGRY Z features, platform fees, food orders, payments, accounts, canteens, faculty events, tokens, cancellations, refunds, HUNGRY AI Scan and privacy. Try asking about one of those, or email hungryofficialx@gmail.com for personal help.",
  hi: "मैं HUNGRY Z की सुविधाओं, platform fee, food orders, payments, accounts, canteen, faculty events, tokens, cancellations, refunds, HUNGRY AI Scan और privacy में मदद कर सकता हूँ। इनमें से किसी विषय पर पूछें, या व्यक्तिगत सहायता के लिए hungryofficialx@gmail.com पर लिखें।",
  kn: "HUNGRY Z ವೈಶಿಷ್ಟ್ಯಗಳು, platform fee, food orders, payments, accounts, canteen, faculty events, tokens, cancellations, refunds, HUNGRY AI Scan ಮತ್ತು privacy ಬಗ್ಗೆ ಸಹಾಯ ಮಾಡಬಹುದು. ಇವುಗಳಲ್ಲಿ ಯಾವುದಾದರೂ ವಿಷಯ ಕೇಳಿ ಅಥವಾ ವೈಯಕ್ತಿಕ ಸಹಾಯಕ್ಕೆ hungryofficialx@gmail.com ಗೆ ಬರೆಯಿರಿ.",
};

export function getWebsiteAssistantAnswer(question: string, language: AssistantLanguage): string {
  const normalized = question.toLocaleLowerCase().normalize("NFC");
  const topicOrder: Topic[] = ["event", "refund", "payment", "cancel", "fees", "canteen", "order", "account", "scanner", "privacy", "support", "features"];
  const matched = topicOrder.find((topic) =>
    Object.values(topicWords[topic]).some((words) => words.some((word) => normalized.includes(word.toLocaleLowerCase()))),
  );
  return matched ? answers[matched][language] : fallback[language];
}

export const assistantUiText: Record<AssistantLanguage, { title: string; subtitle: string; greeting: string; placeholder: string; send: string; close: string; open: string; language: string; error: string }> = {
  en: { title: "HUNGRY Z Help", subtitle: "Answers about the website", greeting: "Hi! Ask me about ordering, payments, events or your account.", placeholder: "Type your question…", send: "Send", close: "Close chat", open: "Ask HUNGRY Z", language: "Reply language", error: "I couldn't prepare an answer. Please try another HUNGRY Z question or contact hungryofficialx@gmail.com." },
  hi: { title: "HUNGRY Z सहायता", subtitle: "वेबसाइट के बारे में जवाब", greeting: "नमस्ते! ऑर्डर, भुगतान, कार्यक्रम या खाते के बारे में पूछें।", placeholder: "अपना सवाल लिखें…", send: "भेजें", close: "चैट बंद करें", open: "HUNGRY Z से पूछें", language: "जवाब की भाषा", error: "जवाब तैयार नहीं हो सका। HUNGRY Z के बारे में दूसरा सवाल पूछें या hungryofficialx@gmail.com पर संपर्क करें।" },
  kn: { title: "HUNGRY Z ಸಹಾಯ", subtitle: "ವೆಬ್‌ಸೈಟ್ ಕುರಿತು ಉತ್ತರಗಳು", greeting: "ನಮಸ್ಕಾರ! ಆರ್ಡರ್, ಪಾವತಿ, ಕಾರ್ಯಕ್ರಮ ಅಥವಾ ಖಾತೆ ಬಗ್ಗೆ ಕೇಳಿ.", placeholder: "ನಿಮ್ಮ ಪ್ರಶ್ನೆ ಬರೆಯಿರಿ…", send: "ಕಳುಹಿಸಿ", close: "ಚಾಟ್ ಮುಚ್ಚಿ", open: "HUNGRY Z ಅನ್ನು ಕೇಳಿ", language: "ಉತ್ತರದ ಭಾಷೆ", error: "ಉತ್ತರ ಸಿದ್ಧಪಡಿಸಲಾಗಲಿಲ್ಲ. HUNGRY Z ಕುರಿತು ಮತ್ತೊಂದು ಪ್ರಶ್ನೆ ಕೇಳಿ ಅಥವಾ hungryofficialx@gmail.com ಸಂಪರ್ಕಿಸಿ." },
};
