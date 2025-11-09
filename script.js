// =========================================================
// === SCRIPT.JS - كود JavaScript الكامل لنظام الحضور ===
// =========================================================

// ==================== 1. المُتغيرات والثوابت ====================
const workersKey = 'workers';
const presenceKey = 'presence';
const holidaysKey = 'holidays';
const absencesKey = 'absences';

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let currentFilter = 'all'; // الفلتر الافتراضي للجدول
let selectedTableWorkers = [];
let currentSort = { column: 'date', direction: 'desc' }; // الفرز الافتراضي

// ==================== 2. دوال المساعدة الأساسية ====================

// إدارة الإشعارات (Toast)
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `show ${type}`; 
    
    // إخفاء الإشعار بعد 3 ثوانٍ
    setTimeout(() => {
        toast.className = '';
    }, 3000);
}

// جلب قوائم البيانات من Local Storage
function getWorkersList() {
    const workersData = localStorage.getItem(workersKey);
    return workersData ? JSON.parse(workersData) : [];
}

function getPresenceList() {
    const presenceData = localStorage.getItem(presenceKey);
    return presenceData ? JSON.parse(presenceData) : [];
}

function getHolidaysList() {
    const holidaysData = localStorage.getItem(holidaysKey);
    return holidaysData ? JSON.parse(holidaysData) : [];
}

function getAbsencesList() {
    const absencesData = localStorage.getItem(absencesKey);
    return absencesData ? JSON.parse(absencesData) : [];
}

// تحويل الوقت: حساب الفرق بين وقتين بالدقائق
function timeDiffInMinutes(start, end) {
    if (!start || !end) return 0;
    const startTime = new Date(`1970/01/01 ${start}`);
    const endTime = new Date(`1970/01/01 ${end}`);
    
    if (endTime < startTime) {
        // إذا كان وقت الخروج في اليوم التالي (عمل ليلي)
        endTime.setDate(endTime.getDate() + 1);
    }
    return (endTime - startTime) / (1000 * 60);
}

// تنسيق الدقائق إلى ساعات (مثال: 480 دقيقة تصبح 8.00 ساعات)
function formatHours(minutes) {
    if (isNaN(minutes) || minutes < 0) return '0.00';
    const hours = minutes / 60;
    return hours.toFixed(2);
}

// حساب صافي ساعات العمل (يشمل الاستراحة)
function calculateHours(entry, exit, breakStart, breakEnd) {
    const totalMinutes = timeDiffInMinutes(entry, exit);
    let breakMinutes = 0;

    if (breakStart && breakEnd) {
        breakMinutes = timeDiffInMinutes(breakStart, breakEnd);
    }
    
    // يجب التأكد أن الدقائق الإجمالية أكبر من دقائق الاستراحة
    const netMinutes = totalMinutes - breakMinutes;
    return netMinutes > 0 ? netMinutes : 0;
}

// ==================== 3. إدارة الموظفين (Employees) ====================

// إضافة موظف جديد (حل مشكلة التسجيل)
function addWorker() {
    const name = document.getElementById('workerName').value.trim();
    const department = document.getElementById('workerDepartment').value.trim();
    const defaultEntry = document.getElementById('defaultEntry').value;
    const defaultExit = document.getElementById('defaultExit').value;

    if (!name || !department) {
        showToast("الرجاء إدخال اسم الموظف والقسم.", "error");
        return;
    }

    let workers = getWorkersList();
    const newWorker = {
        id: Date.now(), 
        name: name,
        department: department,
        defaultEntry: defaultEntry,
        defaultExit: defaultExit
    };

    workers.push(newWorker);
    localStorage.setItem(workersKey, JSON.stringify(workers));

    showToast(`تمت إضافة الموظف "${name}" بنجاح.`, "success");
    loadWorkersList(); 
    loadWorkersIntoSelects(); 
    
    // مسح الحقول
    document.getElementById('workerName').value = '';
    document.getElementById('workerDepartment').value = '';
}

// عرض قائمة الموظفين (لتحديث الواجهة في تبويب Employees)
function loadWorkersList() {
    const workerListElement = document.getElementById('workerList');
    if (!workerListElement) return;
    
    const workers = getWorkersList();
    workerListElement.innerHTML = ''; 

    if (workers.length === 0) {
        workerListElement.innerHTML = '<li style="color: #6c757d; justify-content: center;">لا يوجد موظفون مسجلون حالياً.</li>';
    } else {
        workers.forEach(worker => {
            const li = document.createElement('li');
            li.className = 'worker-item';
            li.innerHTML = `
                <span>${worker.name} (${worker.department})</span>
                <small>دخول: ${worker.defaultEntry} / خروج: ${worker.defaultExit}</small>
                <button onclick="removeWorker(${worker.id})" style="background-color: #dc3545; margin-left: 10px; padding: 5px 10px;">حذف</button>
            `;
            workerListElement.appendChild(li);
        });
    }
    // تحديث مؤشر KPI الإجمالي
    document.getElementById('kpiTotalWorkers').textContent = workers.length;
}

// حذف موظف
function removeWorker(workerId) {
    let workers = getWorkersList();
    const name = workers.find(w => w.id === workerId)?.name;
    
    workers = workers.filter(worker => worker.id !== workerId);
    localStorage.setItem(workersKey, JSON.stringify(workers));
    
    showToast(`تم حذف الموظف ${name}.`, "error");
    loadWorkersList();
    loadWorkersIntoSelects();
    // (يجب أيضاً حذف سجلات حضوره وغياباته المرتبطة به)
}

// تحديث قوائم الاختيار (Selects) في جميع التبويبات
function loadWorkersIntoSelects() {
    const workers = getWorkersList();
    
    // قوائم اختيار بسيطة
    const simpleSelects = ['workerSelect', 'absenceWorker', 'calendarWorker', 'reportsWorkerSelect', 'profileWorkerSelect'];
    simpleSelects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (select) {
            // حفظ القيمة المحددة حالياً
            const currentValue = select.value;
            select.innerHTML = '';
            
            // إضافة خيار "الكل" لقوائم التقارير والتقويم
            if (selectId === 'calendarWorker' || selectId === 'reportsWorkerSelect') {
                 const allOption = document.createElement('option');
                 allOption.value = 'all';
                 allOption.textContent = 'جميع الموظفين';
                 select.appendChild(allOption);
            } else if (selectId !== 'profileWorkerSelect') {
                 // خيار "اختر" افتراضي للقوائم الأخرى
                 const defaultOption = document.createElement('option');
                 defaultOption.value = '';
                 defaultOption.textContent = '-- اختر --';
                 defaultOption.disabled = true;
                 defaultOption.selected = true;
                 select.appendChild(defaultOption);
            }
            
            // إضافة الموظفين
            workers.forEach(worker => {
                const option = document.createElement('option');
                option.value = worker.id;
                option.textContent = `${worker.name} (${worker.department})`;
                select.appendChild(option);
            });
            // محاولة إعادة تحديد القيمة التي كانت محددة
            select.value = currentValue;
        }
    });
    
    // قوائم اختيار Custom Select (للتسجيل السريع والجدول)
    // (يجب بناء هذه الوظائف لتعمل مع الـ HTML المخصص)
    // ...
}


// ==================== 4. إدارة التبويبات (openTab) ====================

function openTab(evt, tabName) {
    let i, tabcontent, tablinks;

    // إخفاء كل المحتوى
    tabcontent = document.getElementsByClassName("tab-content-card");
    for (i = 0; i < tabcontent.length; i++) {
        tabcontent[i].classList.add("hidden");
    }

    // إلغاء تفعيل الزر النشط
    tablinks = document.getElementsByClassName("tab-button");
    for (i = 0; i < tablinks.length; i++) {
        tablinks[i].classList.remove("active");
    }

    // إظهار التبويب المطلوب
    document.getElementById(tabName).classList.remove("hidden");
    // تفعيل الزر
    evt.currentTarget.classList.add("active");
    
    // استدعاء وظائف تحميل البيانات (حل مشكلة التبويبات الفارغة)
    if(tabName === 'employees') { 
        loadWorkersList(); 
        // loadHolidayList(); 
        // loadDashboardSummary(); 
        // loadPendingActions(); 
    }
    if(tabName === 'reports') { 
        loadWorkersIntoSelects(); 
        // calculateKPIs(); 
        // drawChart(); 
    } 
    if(tabName === 'table') { 
        loadWorkersIntoSelects(); 
        // loadPresence(); 
        // updatePeriodFilterButtonLabel(); 
        // updateSortButtonLabel(); 
    } 
    if(tabName === 'calendar') { 
        loadWorkersIntoSelects(); 
        // drawCalendar(currentYear, currentMonth); 
    } 
    if(tabName === 'register') { 
        loadWorkersIntoSelects(); 
        // loadQuickSummary();
        // loadPlannedAbsenceList();
    }
    if(tabName === 'profile') {
        loadWorkersIntoSelects(); // لتحديث قائمة اختيار الموظف
    }
}


// (يجب بناء باقي الدوال المرتبطة بالـ register, table, calendar, reports لاستكمال التطبيق)

// ==================== 5. التهيئة (Initialization) ====================

function openDefaultTab() {
    // فتح تبويب 'employees' افتراضياً
    const employeesTab = document.getElementById('employees');
    const defaultButton = document.querySelector('.tab-navigation .tab-button');
    
    if (employeesTab) employeesTab.classList.remove('hidden');
    if (defaultButton) defaultButton.classList.add('active');
    
    // تحميل بيانات التبويب الأول
    loadWorkersList();
    // loadDashboardSummary();
}

// التشغيل عند تحميل النافذة
window.onload = function() {
    openDefaultTab();
    loadWorkersIntoSelects(); 
    // ... (أي تهيئات أخرى مثل تعيين التاريخ الحالي)
};
