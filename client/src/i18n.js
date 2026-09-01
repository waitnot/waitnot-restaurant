import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Translation resources
const resources = {
  en: {
    translation: {
      // Navigation
      "discover": "Discover Restaurants Near You",
      "search": "Search restaurants, dishes...",
      "delivery": "Delivery",
      "menu": "Menu",
      "cart": "Cart",
      "checkout": "Checkout",
      
      // Restaurant
      "rating": "Rating",
      "deliveryTime": "Delivery Time",
      "min": "min",
      "deliveryAvailable": "Delivery Available",
      "cuisines": "Cuisines",
      "addToCart": "Add to Cart",
      "add": "Add",
      "veg": "Veg",
      "nonVeg": "Non-Veg",
      "all": "All",
      "starters": "Starters",
      "mainCourse": "Main Course",
      "desserts": "Desserts",
      "drinks": "Drinks",
      
      // Category translations
      "Starters": "Starters",
      "Main Course": "Main Course",
      "Desserts": "Desserts",
      "Drinks": "Drinks",
      
      // Additional translations
      "Cuisines": "Cuisines",
      
      // Cart & Checkout
      "items": "items",
      "total": "Total",
      "subtotal": "Subtotal",
      "proceedToCheckout": "Proceed to Checkout",
      "customerInfo": "Customer Information",
      "name": "Name",
      "phone": "Phone",
      "address": "Address",
      "paymentMethod": "Payment Method",
      "placeOrder": "Place Order",
      "emptyCart": "Your cart is empty",
      "startShopping": "Start shopping to add items",
      
      // Orders
      "orderPlaced": "Order Placed Successfully!",
      "orderNumber": "Order Number",
      "thankYou": "Thank you for your order",
      "trackOrder": "Track your order",
      
      // Common
      "loading": "Loading...",
      "cancel": "Cancel",
      "update": "Update",
      "delete": "Delete",
      "edit": "Edit",
      "save": "Save",
      "close": "Close",
      "noResults": "No restaurants found",
      "tryDifferent": "Try a different search"
    }
  },
  hi: {
    translation: {
      "discover": "अपने आस-पास रेस्तरां खोजें",
      "search": "रेस्तरां, व्यंजन खोजें...",
      "delivery": "डिलीवरी",
      "menu": "मेनू",
      "cart": "कार्ट",
      "checkout": "चेकआउट",
      
      "rating": "रेटिंग",
      "deliveryTime": "डिलीवरी समय",
      "min": "मिनट",
      "deliveryAvailable": "डिलीवरी उपलब्ध",
      "cuisines": "व्यंजन",
      "addToCart": "कार्ट में जोड़ें",
      "add": "जोड़ें",
      "veg": "शाकाहारी",
      "nonVeg": "मांसाहारी",
      "all": "सभी",
      "starters": "स्टार्टर",
      "mainCourse": "मुख्य व्यंजन",
      "desserts": "मिठाई",
      "drinks": "पेय",
      
      // Category translations
      "Starters": "स्टार्टर",
      "Main Course": "मुख्य व्यंजन",
      "Desserts": "मिठाई",
      "Drinks": "पेय",
      
      // Additional translations
      "Cuisines": "व्यंजन",
      
      "items": "आइटम",
      "total": "कुल",
      "subtotal": "उप-योग",
      "proceedToCheckout": "चेकआउट पर जाएं",
      "customerInfo": "ग्राहक जानकारी",
      "name": "नाम",
      "phone": "फोन",
      "address": "पता",
      "paymentMethod": "भुगतान विधि",
      "placeOrder": "ऑर्डर करें",
      "emptyCart": "आपका कार्ट खाली है",
      "startShopping": "आइटम जोड़ने के लिए खरीदारी शुरू करें",
      
      "orderPlaced": "ऑर्डर सफलतापूर्वक दिया गया!",
      "orderNumber": "ऑर्डर नंबर",
      "thankYou": "आपके ऑर्डर के लिए धन्यवाद",
      "trackOrder": "अपना ऑर्डर ट्रैक करें",
      
      "loading": "लोड हो रहा है...",
      "cancel": "रद्द करें",
      "update": "अपडेट करें",
      "delete": "हटाएं",
      "edit": "संपादित करें",
      "save": "सहेजें",
      "close": "बंद करें",
      "noResults": "कोई रेस्तरां नहीं मिला",
      "tryDifferent": "एक अलग खोज का प्रयास करें"
    }
  },
  es: {
    translation: {
      "discover": "Descubre Restaurantes Cerca de Ti",
      "search": "Buscar restaurantes, platos...",
      "delivery": "Entrega",
      "menu": "Menú",
      "cart": "Carrito",
      "checkout": "Pagar",
      
      "rating": "Calificación",
      "deliveryTime": "Tiempo de Entrega",
      "min": "min",
      "deliveryAvailable": "Entrega Disponible",
      "cuisines": "Cocinas",
      "addToCart": "Añadir al Carrito",
      "add": "Añadir",
      "veg": "Vegetariano",
      "nonVeg": "No Vegetariano",
      "all": "Todos",
      "starters": "Entrantes",
      "mainCourse": "Plato Principal",
      "desserts": "Postres",
      "drinks": "Bebidas",
      
      "Starters": "Entrantes",
      "Main Course": "Plato Principal",
      "Desserts": "Postres",
      "Drinks": "Bebidas",
      
      "items": "artículos",
      "total": "Total",
      "subtotal": "Subtotal",
      "proceedToCheckout": "Proceder al Pago",
      "customerInfo": "Información del Cliente",
      "name": "Nombre",
      "phone": "Teléfono",
      "address": "Dirección",
      "paymentMethod": "Método de Pago",
      "placeOrder": "Realizar Pedido",
      "emptyCart": "Tu carrito está vacío",
      "startShopping": "Comienza a comprar para añadir artículos",
      
      "orderPlaced": "¡Pedido Realizado con Éxito!",
      "orderNumber": "Número de Pedido",
      "thankYou": "Gracias por tu pedido",
      "trackOrder": "Rastrea tu pedido",
      
      "loading": "Cargando...",
      "cancel": "Cancelar",
      "update": "Actualizar",
      "delete": "Eliminar",
      "edit": "Editar",
      "save": "Guardar",
      "close": "Cerrar",
      "noResults": "No se encontraron restaurantes",
      "tryDifferent": "Intenta una búsqueda diferente"
    }
  },
  fr: {
    translation: {
      "discover": "Découvrez les Restaurants Près de Chez Vous",
      "search": "Rechercher restaurants, plats...",
      "delivery": "Livraison",
      "menu": "Menu",
      "cart": "Panier",
      "checkout": "Commander",
      
      "rating": "Note",
      "deliveryTime": "Temps de Livraison",
      "deliveryAvailable": "Livraison Disponible",
      "cuisines": "Cuisines",
      "addToCart": "Ajouter au Panier",
      "add": "Ajouter",
      "veg": "Végétarien",
      "nonVeg": "Non Végétarien",
      
      "items": "articles",
      "total": "Total",
      "subtotal": "Sous-total",
      "proceedToCheckout": "Passer à la Caisse",
      "customerInfo": "Informations Client",
      "name": "Nom",
      "phone": "Téléphone",
      "address": "Adresse",
      "paymentMethod": "Méthode de Paiement",
      "placeOrder": "Passer Commande",
      
      "orderPlaced": "Commande Passée avec Succès!",
      "orderNumber": "Numéro de Commande",
      "thankYou": "Merci pour votre commande",
      
      "loading": "Chargement...",
      "cancel": "Annuler",
      "update": "Mettre à jour",
      "delete": "Supprimer",
      "edit": "Modifier",
      "save": "Enregistrer",
      "close": "Fermer"
    }
  },
  zh: {
    translation: {
      "discover": "发现您附近的餐厅",
      "search": "搜索餐厅、菜品...",
      "delivery": "外卖",
      "menu": "菜单",
      "cart": "购物车",
      "checkout": "结账",
      
      "rating": "评分",
      "deliveryTime": "配送时间",
      "min": "分钟",
      "deliveryAvailable": "可配送",
      "cuisines": "菜系",
      "addToCart": "加入购物车",
      "add": "添加",
      "veg": "素食",
      "nonVeg": "非素食",
      "all": "全部",
      "starters": "开胃菜",
      "mainCourse": "主菜",
      "desserts": "甜点",
      "drinks": "饮料",
      
      "Starters": "开胃菜",
      "Main Course": "主菜",
      "Desserts": "甜点",
      "Drinks": "饮料",
      "Cuisines": "菜系",
      
      "items": "项",
      "total": "总计",
      "subtotal": "小计",
      "proceedToCheckout": "去结账",
      "customerInfo": "客户信息",
      "name": "姓名",
      "phone": "电话",
      "address": "地址",
      "paymentMethod": "支付方式",
      "placeOrder": "下单",
      "emptyCart": "购物车是空的",
      "startShopping": "开始购物以添加商品",
      
      "orderPlaced": "订单已成功下达！",
      "orderNumber": "订单号",
      "thankYou": "感谢您的订单",
      "trackOrder": "追踪您的订单",
      
      "loading": "加载中...",
      "cancel": "取消",
      "update": "更新",
      "delete": "删除",
      "edit": "编辑",
      "save": "保存",
      "close": "关闭",
      "noResults": "未找到餐厅",
      "tryDifferent": "尝试不同的搜索"
    }
  },
  ar: {
    translation: {
      "discover": "اكتشف المطاعم القريبة منك",
      "search": "ابحث عن مطاعم، أطباق...",
      "delivery": "التوصيل",
      "menu": "القائمة",
      "cart": "السلة",
      "checkout": "الدفع",
      
      "rating": "التقييم",
      "deliveryTime": "وقت التوصيل",
      "deliveryAvailable": "التوصيل متاح",
      "cuisines": "المطابخ",
      "addToCart": "أضف إلى السلة",
      "add": "أضف",
      "veg": "نباتي",
      "nonVeg": "غير نباتي",
      
      "items": "عناصر",
      "total": "المجموع",
      "subtotal": "المجموع الفرعي",
      "proceedToCheckout": "المتابعة للدفع",
      "customerInfo": "معلومات العميل",
      "name": "الاسم",
      "phone": "الهاتف",
      "address": "العنوان",
      "paymentMethod": "طريقة الدفع",
      "placeOrder": "تقديم الطلب",
      
      "orderPlaced": "تم تقديم الطلب بنجاح!",
      "orderNumber": "رقم الطلب",
      "thankYou": "شكراً لطلبك",
      
      "loading": "جاري التحميل...",
      "cancel": "إلغاء",
      "update": "تحديث",
      "delete": "حذف",
      "edit": "تعديل",
      "save": "حفظ",
      "close": "إغلاق"
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
