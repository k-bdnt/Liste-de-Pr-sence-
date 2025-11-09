document.addEventListener("DOMContentLoaded", () => {

    /* ----------------- TABS NAVIGATION ----------------- */
    const tabs = document.querySelectorAll(".tab-button");
    const tabContents = document.querySelectorAll(".tab-content-card");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
            const target = tab.dataset.target;
            tabContents.forEach(c => c.classList.add("hidden"));
            document.getElementById(target).classList.remove("hidden");
        });
    });

    /* ----------------- CUSTOM SELECT ----------------- */
    const customSelectButtons = document.querySelectorAll(".custom-select-button");
    customSelectButtons.forEach(button => {
        const dropdown = button.nextElementSibling;
        button.addEventListener("click", () => {
            button.classList.toggle("active");
            dropdown.style.display = button.classList.contains("active") ? "block" : "none";
        });
        dropdown.querySelectorAll(".dropdown-item-label").forEach(item => {
            item.addEventListener("click", () => {
                dropdown.querySelectorAll(".dropdown-item-label").forEach(i => i.classList.remove("selected"));
                item.classList.add("selected");
                button.querySelector("span").textContent = item.textContent;
                button.classList.remove("active");
                dropdown.style.display = "none";
                applyCustomFilter(item.dataset.value);
            });
        });
    });

    /* ----------------- PERIOD FILTER ----------------- */
    const periodFilterButton = document.getElementById("periodFilterButton");
    const periodFilterDropdown = document.getElementById("periodFilterDropdown");
    periodFilterButton?.addEventListener("click", () => {
        periodFilterDropdown.style.display = periodFilterDropdown.style.display === "block" ? "none" : "block";
    });
    periodFilterDropdown?.querySelectorAll(".period-filter-option").forEach(option => {
        option.addEventListener("click", () => {
            periodFilterDropdown.querySelectorAll(".period-filter-option").forEach(o => o.classList.remove("active"));
            option.classList.add("active");
            periodFilterButton.textContent = option.textContent;
            periodFilterDropdown.style.display = "none";
            applyPeriodFilter(option.dataset.value);
        });
    });

    /* ----------------- SORT DROPDOWN ----------------- */
    const sortFilterButton = document.getElementById("sortFilterButton");
    const sortFilterDropdown = document.getElementById("sortFilterDropdown");
    sortFilterButton?.addEventListener("click", () => {
        sortFilterDropdown.style.display = sortFilterDropdown.style.display === "block" ? "none" : "block";
    });
    sortFilterDropdown?.querySelectorAll(".sort-filter-option").forEach(option => {
        option.addEventListener("click", () => {
            sortFilterDropdown.querySelectorAll(".sort-filter-option").forEach(o => o.classList.remove("active"));
            option.classList.add("active");
            sortFilterButton.textContent = option.textContent;
            sortFilterDropdown.style.display = "none";
            applySort(option.dataset.value);
        });
    });

    /* ----------------- MODALS ----------------- */
    const modals = document.querySelectorAll(".modal");
    const closeButtons = document.querySelectorAll(".close-button");
    closeButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            btn.closest(".modal").style.display = "none";
        });
    });
    window.addEventListener("click", (e) => {
        modals.forEach(modal => {
            if(e.target === modal) modal.style.display = "none";
        });
    });

    /* ----------------- QUICK PUNCH / REGISTER ----------------- */
    window.quickPunch = function(type, workerId) {
        // type = 'in' / 'out'
        console.log(`Quick punch ${type} for worker: ${workerId}`);
        updateTable(workerId, type);
        updateDashboard();
    }

    window.registerPresence = function(workerId) {
        console.log(`Register presence for worker: ${workerId}`);
        updateTable(workerId, "in");
        updateDashboard();
    }

    window.registerPlannedAbsence = function(workerId) {
        console.log(`Planned absence for worker: ${workerId}`);
        markRowAbsence(workerId);
        updateDashboard();
    }

    /* ----------------- TABLE FILTER / SORT FUNCTIONS ----------------- */
    const presenceTable = document.getElementById("presenceTable");

    function applyCustomFilter(value) {
        [...presenceTable.rows].forEach((row, index) => {
            if(index === 0) return; // skip header
            if(value === "all" || row.dataset.role === value) row.style.display = "";
            else row.style.display = "none";
        });
    }

    function applyPeriodFilter(period) {
        // Example: "today", "week", "month"
        console.log(`Apply period filter: ${period}`);
        // هنا ممكن تضيف كود لتصفية الجدول حسب التاريخ
    }

    function applySort(sortKey) {
        const rows = [...presenceTable.rows].slice(1);
        rows.sort((a,b) => {
            const valA = a.querySelector(`td[data-sort='${sortKey}']`)?.textContent || "";
            const valB = b.querySelector(`td[data-sort='${sortKey}']`)?.textContent || "";
            return valA.localeCompare(valB, undefined, {numeric:true});
        });
        rows.forEach(r => presenceTable.appendChild(r));
    }

    function updateTable(workerId, action) {
        const row = presenceTable.querySelector(`tr[data-worker='${workerId}']`);
        if(!row) return;
        if(action === "in") {
            row.classList.remove("row-absence");
            row.classList.add("row-active-punch");
            row.cells[7].textContent = "Present"; // Example: Statut column
        } else if(action === "out") {
            row.classList.remove("row-active-punch");
            row.cells[7].textContent = "Out";
        }
    }

    function markRowAbsence(workerId) {
        const row = presenceTable.querySelector(`tr[data-worker='${workerId}']`);
        if(row) {
            row.classList.add("row-absence");
            row.cells[7].textContent = "Absent";
        }
    }

    /* ----------------- DASHBOARD UPDATE ----------------- */
    function updateDashboard() {
        const presenceList = document.getElementById("presenceNowList");
        const pendingList = document.getElementById("pendingActionsList");
        presenceList.innerHTML = "";
        pendingList.innerHTML = "";
        [...presenceTable.rows].slice(1).forEach(row => {
            const statut = row.cells[7].textContent.toLowerCase();
            const name = row.cells[1].textContent; // example: name column
            if(statut === "present") {
                const li = document.createElement("li");
                li.innerHTML = `<i class="fas fa-user-check"></i>${name}`;
                presenceList.appendChild(li);
            } else if(statut === "absent") {
                const li = document.createElement("li");
                li.textContent = name;
                pendingList.appendChild(li);
            }
        });
    }

    /* ----------------- CALENDAR CLICK ----------------- */
    const calendarDays = document.querySelectorAll(".calendar.month-view .day");
    calendarDays.forEach(day => {
        day.addEventListener("click", () => {
            const date = day.dataset.date;
            console.log(`Clicked day: ${date}`);
            // هنا ممكن تظهر مودال مع التفاصيل أو الإجراءات الخاصة باليوم
        });
    });

    /* ----------------- CLOSE DROPDOWNS ON OUTSIDE CLICK ----------------- */
    document.addEventListener("click", (e) => {
        customSelectButtons.forEach(button => {
            if(!button.contains(e.target) && !button.nextElementSibling.contains(e.target)) {
                button.classList.remove("active");
                button.nextElementSibling.style.display = "none";
            }
        });
        if(periodFilterButton && !periodFilterButton.contains(e.target) && !periodFilterDropdown.contains(e.target)) {
            periodFilterDropdown.style.display = "none";
        }
        if(sortFilterButton && !sortFilterButton.contains(e.target) && !sortFilterDropdown.contains(e.target)) {
            sortFilterDropdown.style.display = "none";
        }
    });

    // Initial Dashboard Render
    updateDashboard();

});
