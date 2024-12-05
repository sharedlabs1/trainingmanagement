// Global variables
let toggleBtn;
let formContainer;

// Helper Functions
function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    const mainContent = document.querySelector('.container-fluid');
    if (mainContent) {
        mainContent.insertAdjacentElement('afterbegin', alertDiv);
        setTimeout(() => alertDiv.remove(), 5000);
    }
}

function generateUniqueNumber(prefix) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
}

// Navigation Functions
function showPage(pageId) {
    // Hide all pages
    const pages = document.querySelectorAll('.content-page');
    pages.forEach(page => page.style.display = 'none');
    
    // Show selected page
    const selectedPage = document.getElementById(`${pageId}Page`);
    if (selectedPage) {
        selectedPage.style.display = 'block';
    }
    
    // Update active nav link
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('data-page') === pageId) {
            link.classList.add('active');
        }
    });

    // Load data based on page
    if (pageId === 'leads') {
        loadLeads();
    } else if (pageId === 'quotations') {
        loadQuotations();
    } else if (pageId === 'orders') {
        loadOrders();
    } else if (pageId === 'trainers') {
        loadTrainers();
    }
}

// Form Display Functions
function showLeadForm() {
    const leadFormCard = document.getElementById('leadFormCard');
    if (leadFormCard) {
        leadFormCard.style.display = 'block';
        const leadNumber = document.getElementById('leadNumber');
        if (leadNumber) {
            leadNumber.value = generateUniqueNumber('LD');
        }
    }
}

function showQuotationForm() {
    const quotationFormCard = document.getElementById('quotationFormCard');
    if (!quotationFormCard) return;
    
    // Generate new quotation number
    const timestamp = new Date().getTime();
    document.getElementById('quotationNumber').value = `QT-${timestamp}`;
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('#quotationForm [name="date"]').value = today;
    
    quotationFormCard.style.display = 'block';
}

function hideQuotationForm() {
    const quotationFormCard = document.getElementById('quotationFormCard');
    if (!quotationFormCard) return;
    
    quotationFormCard.style.display = 'none';
    document.getElementById('quotationForm').reset();
    document.getElementById('quotationItems').innerHTML = '';
    updateQuotationTotals();
}

function showOrderForm() {
    const orderFormCard = document.getElementById('orderFormCard');
    if (!orderFormCard) return;
    
    // Generate new order number
    const timestamp = new Date().getTime();
    document.getElementById('orderNumber').value = `ORD-${timestamp}`;
    
    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('#orderForm [name="orderDate"]').value = today;
    
    // Show the form
    orderFormCard.style.display = 'block';
    
    // Load quotations for dropdown
    loadQuotationsForOrder();
}

function hideOrderForm() {
    const orderFormCard = document.getElementById('orderFormCard');
    if (!orderFormCard) return;
    
    orderFormCard.style.display = 'none';
    document.getElementById('orderForm').reset();
    document.getElementById('orderItems').innerHTML = '';
    document.getElementById('quotationSection').style.display = 'none';
    calculateOrderTotals();
}

function showTrainerForm() {
    document.getElementById('trainerFormCard').style.display = 'block';
}

function hideTrainerForm() {
    document.getElementById('trainerFormCard').style.display = 'none';
    document.getElementById('trainerForm').reset();
}

// Data Loading Functions
async function loadLeads() {
    try {
        const response = await fetch('/api/leads');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const leads = await response.json();
        const leadsTableBody = document.getElementById('leadsTableBody');
        if (!leadsTableBody) {
            console.error('Leads table body not found');
            return;
        }
        
        leadsTableBody.innerHTML = '';
        
        if (!Array.isArray(leads)) {
            console.error('Leads data is not an array:', leads);
            return;
        }

        leads.forEach(lead => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${lead.leadNumber || ''}</td>
                <td>${lead.companyName || ''}</td>
                <td>${lead.contactPerson || ''}</td>
                <td>${lead.email || ''}</td>
                <td>${lead.phone || ''}</td>
                <td><span class="badge ${getLeadStatusBadgeColor(lead.status)}">${lead.status || ''}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewLeadDetails('${lead._id}')">View</button>
                    <button class="btn btn-sm btn-success" onclick="createQuotation('${lead._id}')">Create Quotation</button>
                </td>
            `;
            leadsTableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading leads:', error);
    }
}

async function loadQuotations() {
    try {
        const response = await fetch('/api/quotations');
        const quotations = await response.json();
        
        const quotationsList = document.getElementById('quotationsList');
        if (!quotationsList) return;

        quotationsList.innerHTML = quotations.map(quotation => `
            <tr>
                <td>${quotation.quotationNumber}</td>
                <td>${new Date(quotation.date).toLocaleDateString()}</td>
                <td>${quotation.clientName}</td>
                <td>₹${quotation.total?.toFixed(2) || '0.00'}</td>
                <td>
                    <span class="badge bg-${getQuotationStatusBadgeColor(quotation.status)}">
                        ${quotation.status || 'Pending'}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-sm btn-outline-primary" onclick="viewQuotationDetails('${quotation._id}')">
                            <i class="bi bi-eye"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading quotations:', error);
        showAlert('Failed to load quotations', 'danger');
    }
}

async function loadQuotationsForOrder() {
    try {
        const response = await fetch('/api/quotations');
        if (!response.ok) throw new Error('Failed to fetch quotations');
        
        const quotations = await response.json();
        const select = document.getElementById('quotationSelect');
        
        select.innerHTML = '<option value="">Select a quotation...</option>';
        quotations.forEach(quotation => {
            select.innerHTML += `
                <option value="${quotation._id}">
                    ${quotation.quotationNumber} - ${quotation.clientName} ($${quotation.total})
                </option>
            `;
        });
    } catch (error) {
        console.error('Error loading quotations:', error);
        showAlert('Failed to load quotations', 'danger');
    }
}

async function loadOrders() {
    try {
        const response = await fetch('/api/orders');
        const orders = await response.json();
        
        const ordersList = document.getElementById('ordersList');
        if (!ordersList) return;

        ordersList.innerHTML = orders.map(order => `
            <tr>
                <td>${order.orderNumber}</td>
                <td>${new Date(order.date).toLocaleDateString()}</td>
                <td>${order.clientName}</td>
                <td>₹${order.total?.toFixed(2) || '0.00'}</td>
                <td>
                    <span class="badge bg-${getOrderStatusBadgeColor(order.status)}">
                        ${order.status || 'Pending'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="viewOrderDetails('${order._id}')">
                        <i class="bi bi-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('Failed to load orders', 'danger');
    }
}

async function loadTrainers() {
    try {
        const response = await fetch('/api/trainers');
        if (!response.ok) throw new Error('Failed to fetch trainers');
        
        const trainers = await response.json();
        const tableBody = document.getElementById('trainersTableBody');
        tableBody.innerHTML = '';
        
        trainers.forEach(trainer => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${trainer.name}</td>
                <td>${trainer.expertise}</td>
                <td>${trainer.email}</td>
                <td>${trainer.phone}</td>
                <td>₹${trainer.dailyRate}</td>
                <td><span class="badge ${trainer.status === 'Active' ? 'bg-success' : 'bg-danger'}">${trainer.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick="showTrainerPoModal('${trainer._id}')">
                        <i class="bi bi-file-earmark-text"></i> Generate PO
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="editTrainer('${trainer._id}')">
                        <i class="bi bi-pencil"></i> Edit
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading trainers:', error);
        showAlert('Failed to load trainers', 'danger');
    }
}

// Status Badge Colors
function getLeadStatusBadgeColor(status) {
    switch (status) {
        case 'New': return 'primary';
        case 'Contacted': return 'info';
        case 'Qualified': return 'warning';
        case 'Converted': return 'success';
        case 'Lost': return 'danger';
        default: return 'secondary';
    }
}

function getQuotationStatusBadgeColor(status) {
    switch (status) {
        case 'Pending': return 'warning';
        case 'Approved': return 'success';
        case 'Rejected': return 'danger';
        default: return 'secondary';
    }
}

function getOrderStatusBadgeColor(status) {
    switch (status) {
        case 'Pending': return 'warning';
        case 'Processing': return 'info';
        case 'Completed': return 'success';
        case 'Cancelled': return 'danger';
        default: return 'secondary';
    }
}

// Quotation Form Functions
function addQuotationItem() {
    const itemsContainer = document.getElementById('quotationItems');
    const itemCount = itemsContainer.children.length + 1;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'quotation-item mb-3 border p-3';
    
    const itemHtml = `
        <div class="row">
            <div class="col-md-6 mb-2">
                <label class="form-label">Item Type</label>
                <select class="form-select item-type" name="item${itemCount}Type" required onchange="handleQuotationItemTypeChange(this)">
                    <option value="">Select type...</option>
                    <option value="Trainer Cost">Trainer Cost</option>
                    <option value="Assessment without Proctoring">Assessment without Proctoring</option>
                    <option value="Assessment with Proctoring">Assessment with Proctoring</option>
                    <option value="Lab Cost per pax per day">Lab Cost per pax per day</option>
                    <option value="Lab Assessment per pax">Lab Assessment per pax</option>
                </select>
            </div>
            <div class="col-md-6 mb-2">
                <label class="form-label">Description</label>
                <input type="text" class="form-control" name="item${itemCount}Description" required>
            </div>
        </div>
        <div class="row cost-fields" style="display: none;">
            <div class="col-md-4 mb-2">
                <label class="form-label">Cost</label>
                <input type="number" class="form-control item-cost" name="item${itemCount}Cost" min="0" step="0.01" oninput="updateQuotationItemTotal(this)">
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Quantity</label>
                <input type="number" class="form-control item-quantity" name="item${itemCount}Quantity" min="1" value="1" oninput="updateQuotationItemTotal(this)">
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Total</label>
                <input type="text" class="form-control item-total" name="item${itemCount}Total" readonly>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-12">
                <button type="button" class="btn btn-danger btn-sm" onclick="removeQuotationItem(this)">
                    <i class="bi bi-trash"></i> Remove Item
                </button>
            </div>
        </div>
    `;
    
    itemDiv.innerHTML = itemHtml;
    itemsContainer.appendChild(itemDiv);
}

function handleQuotationItemTypeChange(select) {
    const itemDiv = select.closest('.quotation-item');
    const costFields = itemDiv.querySelector('.cost-fields');
    
    if (select.value) {
        costFields.style.display = 'flex';
        // Reset and update calculations
        const costInput = itemDiv.querySelector('.item-cost');
        const quantityInput = itemDiv.querySelector('.item-quantity');
        costInput.value = '';
        quantityInput.value = '1';
        updateQuotationItemTotal(costInput);
    } else {
        costFields.style.display = 'none';
        updateQuotationTotals();
    }
}

function removeQuotationItem(button) {
    button.closest('.quotation-item').remove();
    updateQuotationTotals();
}

function updateQuotationItemTotal(input) {
    const itemDiv = input.closest('.quotation-item');
    const cost = parseFloat(itemDiv.querySelector('.item-cost').value) || 0;
    const quantity = parseFloat(itemDiv.querySelector('.item-quantity').value) || 0;
    const total = cost * quantity;
    
    itemDiv.querySelector('.item-total').value = total.toFixed(2);
    updateQuotationTotals();
}

function updateQuotationTotals() {
    const items = document.querySelectorAll('.quotation-item');
    let subtotal = 0;
    
    items.forEach(item => {
        const totalInput = item.querySelector('.item-total');
        if (totalInput && totalInput.value) {
            subtotal += parseFloat(totalInput.value);
        }
    });
    
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    document.getElementById('quotationSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('quotationGst').textContent = formatCurrency(gst);
    document.getElementById('quotationTotal').textContent = formatCurrency(total);
}

// Quotation Form Submission
document.getElementById('quotationForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const items = [];
    let subtotal = 0;
    
    document.querySelectorAll('.quotation-item').forEach(itemDiv => {
        const type = itemDiv.querySelector('.item-type').value;
        const description = itemDiv.querySelector('[name*="Description"]').value;
        const cost = parseFloat(itemDiv.querySelector('.item-cost').value) || 0;
        const quantity = parseFloat(itemDiv.querySelector('.item-quantity').value) || 0;
        const total = parseFloat(itemDiv.querySelector('.item-total').value) || 0;
        
        items.push({
            type,
            description,
            cost,
            quantity,
            total
        });
        
        subtotal += total;
    });
    
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    const quotationData = {
        quotationNumber: this.querySelector('#quotationNumber').value,
        date: this.querySelector('[name="date"]').value,
        clientName: this.querySelector('[name="clientName"]').value,
        contactPerson: this.querySelector('[name="contactPerson"]').value,
        email: this.querySelector('[name="email"]').value,
        phone: this.querySelector('[name="phone"]').value,
        items,
        subtotal,
        gst,
        total
    };
    
    try {
        const response = await fetch('/api/quotations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(quotationData)
        });
        
        if (!response.ok) throw new Error('Failed to create quotation');
        
        const result = await response.json();
        showAlert('Quotation created successfully!', 'success');
        this.reset();
        document.getElementById('quotationItems').innerHTML = '';
        calculateQuotationTotal();
        showPage('quotations');
    } catch (error) {
        console.error('Error creating quotation:', error);
        showAlert('Failed to create quotation. Please try again.', 'danger');
    }
});

// Handle quotation checkbox
document.getElementById('hasQuotation')?.addEventListener('change', function(e) {
    const quotationSection = document.getElementById('quotationSection');
    quotationSection.style.display = e.target.checked ? 'block' : 'none';
});

// Handle quotation selection
document.getElementById('quotationSelect')?.addEventListener('change', async function(e) {
    const quotationId = e.target.value;
    const detailsDiv = document.getElementById('quotationDetails');
    
    if (!quotationId) {
        detailsDiv.style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/quotations/${quotationId}`);
        if (!response.ok) throw new Error('Failed to fetch quotation details');
        
        const quotation = await response.json();
        
        // Auto-fill client details
        document.querySelector('[name="clientName"]').value = quotation.clientName;
        
        // Show quotation details
        detailsDiv.innerHTML = `
            <h6>Quotation Details</h6>
            <p class="mb-1"><strong>Quotation Number:</strong> ${quotation.quotationNumber}</p>
            <p class="mb-1"><strong>Date:</strong> ${new Date(quotation.date).toLocaleDateString()}</p>
            <p class="mb-1"><strong>Total Amount:</strong> ${formatCurrency(quotation.total)}</p>
        `;
        detailsDiv.style.display = 'block';
        
        // Optionally pre-fill order items from quotation
        if (quotation.items && quotation.items.length > 0) {
            const orderItems = document.getElementById('orderItems');
            orderItems.innerHTML = '';
            quotation.items.forEach(item => {
                addOrderItem();
                const lastItem = orderItems.lastElementChild;
                lastItem.querySelector('textarea').value = item.description;
                lastItem.querySelector('[name*="Price"]').value = item.total;
                lastItem.querySelector('[name*="Quantity"]').value = 1;
                calculateOrderItemTotal(lastItem.querySelector('[name*="Price"]'));
            });
        }
    } catch (error) {
        console.error('Error loading quotation details:', error);
        showAlert('Failed to load quotation details', 'danger');
    }
});

// Handle order form submission
document.getElementById('orderForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const items = [];
    let subtotal = 0;
    
    document.querySelectorAll('.order-item').forEach(itemDiv => {
        const description = itemDiv.querySelector('textarea').value;
        const quantity = parseFloat(itemDiv.querySelector('[name*="Quantity"]').value);
        const price = parseFloat(itemDiv.querySelector('[name*="Price"]').value);
        const total = quantity * price;
        
        items.push({
            description,
            quantity,
            unitPrice: price,
            total
        });
        
        subtotal += total;
    });
    
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    const orderData = {
        orderNumber: this.querySelector('#orderNumber').value,
        orderDate: this.querySelector('[name="orderDate"]').value,
        clientName: this.querySelector('[name="clientName"]').value,
        contactPerson: this.querySelector('[name="contactPerson"]').value,
        email: this.querySelector('[name="email"]').value,
        phone: this.querySelector('[name="phone"]').value,
        quotationId: this.querySelector('#hasQuotation').checked ? this.querySelector('#quotationSelect').value : null,
        items,
        subtotal,
        gst,
        total,
        status: 'Pending'
    };
    
    try {
        const response = await fetch('/api/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(orderData)
        });
        
        if (!response.ok) throw new Error('Failed to create order');
        
        const result = await response.json();
        showAlert('Order created successfully!', 'success');
        hideOrderForm();
        loadOrders();
    } catch (error) {
        console.error('Error creating order:', error);
        showAlert('Failed to create order. Please try again.', 'danger');
    }
});

// Handle trainer form submission
document.getElementById('trainerForm')?.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const trainerData = {
        name: formData.get('name'),
        email: formData.get('email'),
        phone: formData.get('phone'),
        expertise: formData.get('expertise'),
        dailyRate: parseFloat(formData.get('dailyRate')),
        status: formData.get('status'),
        notes: formData.get('notes')
    };
    
    try {
        const response = await fetch('/api/trainers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(trainerData)
        });
        
        if (!response.ok) throw new Error('Failed to create trainer');
        
        showAlert('Trainer added successfully!', 'success');
        hideTrainerForm();
        loadTrainers();
    } catch (error) {
        console.error('Error creating trainer:', error);
        showAlert('Failed to create trainer', 'danger');
    }
});

let trainerPoModal = null;

function showTrainerPoModal(trainerId) {
    if (!trainerPoModal) {
        trainerPoModal = new bootstrap.Modal(document.getElementById('trainerPoModal'));
    }
    
    // Set current date as default
    const today = new Date().toISOString().split('T')[0];
    document.querySelector('#trainerPoForm [name="poDate"]').value = today;
    
    // Set PO number
    document.getElementById('poNumber').value = `PO-${Date.now()}`;
    
    // Load orders and trainers into selects
    loadOrdersForPo();
    loadTrainersForPo(trainerId);
    
    trainerPoModal.show();
}

async function loadOrdersForPo() {
    try {
        const response = await fetch('/api/orders');
        if (!response.ok) throw new Error('Failed to fetch orders');
        
        const orders = await response.json();
        const select = document.querySelector('#trainerPoForm [name="orderId"]');
        select.innerHTML = '<option value="">Select order...</option>';
        
        orders.forEach(order => {
            const option = document.createElement('option');
            option.value = order._id;
            option.textContent = `${order.orderNumber} - ${order.clientName}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading orders:', error);
        showAlert('Failed to load orders', 'danger');
    }
}

async function loadTrainersForPo(selectedTrainerId = null) {
    try {
        const response = await fetch('/api/trainers');
        if (!response.ok) throw new Error('Failed to fetch trainers');
        
        const trainers = await response.json();
        const select = document.querySelector('#trainerPoForm [name="trainerId"]');
        select.innerHTML = '<option value="">Select trainer...</option>';
        
        trainers.forEach(trainer => {
            const option = document.createElement('option');
            option.value = trainer._id;
            option.textContent = `${trainer.name} - ${trainer.expertise}`;
            if (trainer._id === selectedTrainerId) {
                option.selected = true;
                document.querySelector('#trainerPoForm [name="dailyRate"]').value = trainer.dailyRate;
            }
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading trainers:', error);
        showAlert('Failed to load trainers', 'danger');
    }
}

// Handle trainer selection change in PO form
document.querySelector('#trainerPoForm [name="trainerId"]')?.addEventListener('change', async function(e) {
    const trainerId = e.target.value;
    if (!trainerId) return;
    
    try {
        const response = await fetch('/api/trainers');
        if (!response.ok) throw new Error('Failed to fetch trainers');
        
        const trainers = await response.json();
        const trainer = trainers.find(t => t._id === trainerId);
        if (trainer) {
            document.querySelector('#trainerPoForm [name="dailyRate"]').value = trainer.dailyRate;
        }
    } catch (error) {
        console.error('Error loading trainer details:', error);
    }
});

async function generateAndSendPO() {
    const form = document.getElementById('trainerPoForm');
    const formData = new FormData(form);
    
    const poData = {
        poNumber: document.getElementById('poNumber').value,
        poDate: formData.get('poDate'),
        orderId: formData.get('orderId'),
        trainerId: formData.get('trainerId'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        dailyRate: parseFloat(formData.get('dailyRate')),
        notes: formData.get('notes')
    };
    
    try {
        const response = await fetch('/api/trainer-pos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(poData)
        });
        
        if (!response.ok) throw new Error('Failed to create PO');
        
        showAlert('Purchase Order generated and sent successfully!', 'success');
        trainerPoModal.hide();
        form.reset();
    } catch (error) {
        console.error('Error generating PO:', error);
        showAlert('Failed to generate Purchase Order', 'danger');
    }
}

// Add event listener for page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = e.target.closest('.nav-link').dataset.page;
            showPage(pageId);
            
            // Load data based on page
            switch(pageId) {
                case 'leads':
                    loadLeads();
                    break;
                case 'quotations':
                    loadQuotations();
                    break;
                case 'orders':
                    loadOrders();
                    break;
                case 'trainers':
                    loadTrainers();
                    break;
            }
        });
    });
    
    // Show dashboard by default
    showPage('dashboard');
});

// Form Submission Handlers
async function handleLeadSubmit(e) {
    e.preventDefault();
    try {
        const formData = new FormData(e.target);
        const leadData = {
            leadNumber: formData.get('leadNumber'),
            date: formData.get('date'),
            companyName: formData.get('companyName'),
            contactPerson: formData.get('contactPerson'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            course: formData.get('course'),
            participants: parseInt(formData.get('participants')),
            requirements: formData.get('requirements'),
            status: 'New'
        };

        const response = await fetch('/api/leads', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(leadData)
        });

        if (!response.ok) {
            throw new Error('Failed to create lead');
        }

        showAlert('Lead created successfully!', 'success');
        e.target.reset();
        document.getElementById('leadFormCard').style.display = 'none';
        loadLeads();
    } catch (error) {
        console.error('Error creating lead:', error);
        showAlert('Failed to create lead. Please try again.', 'danger');
    }
}

// Profit Calculator Functions
let profitCalculatorModal = null;

function showProfitCalculator() {
    if (!profitCalculatorModal) {
        profitCalculatorModal = new bootstrap.Modal(document.getElementById('profitCalculatorModal'));
    }
    loadQuotationsForProfitCalc();
    profitCalculatorModal.show();
}

async function loadQuotationsForProfitCalc() {
    try {
        const response = await fetch('/api/quotations');
        if (!response.ok) throw new Error('Failed to fetch quotations');
        
        const quotations = await response.json();
        const select = document.getElementById('profitQuotationSelect');
        select.innerHTML = '<option value="">Select a quotation...</option>';
        
        quotations.forEach(quotation => {
            const option = document.createElement('option');
            option.value = quotation._id;
            option.textContent = `${quotation.quotationNumber} - ${quotation.clientName}`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading quotations:', error);
        showAlert('Failed to load quotations', 'danger');
    }
}

function calculateItemProfit(item) {
    const price = item.total;
    let cost = item.cost * item.quantity;
    
    // Calculate profit based on item type
    switch (item.type) {
        case 'Trainer Cost':
            return { cost, profit: price - cost };
        case 'Assessment without Proctoring':
            cost = price * 0.6; // 60% of price is cost
            return { cost, profit: price - cost };
        case 'Assessment with Proctoring':
            cost = price * 0.7; // 70% of price is cost
            return { cost, profit: price - cost };
        case 'Lab Cost per pax per day':
            cost = price * 0.5; // 50% of price is cost
            return { cost, profit: price - cost };
        case 'Lab Assessment per pax':
            cost = price * 0.55; // 55% of price is cost
            return { cost, profit: price - cost };
        default:
            cost = price * 0.65; // Default 65% of price is cost
            return { cost, profit: price - cost };
    }
}

function updateProfitAnalysis(quotation) {
    const profitDetails = document.getElementById('profitDetails');
    const itemsContainer = document.getElementById('profitItems');
    itemsContainer.innerHTML = '';
    
    let totalCost = 0;
    let totalPrice = 0;
    
    // Process each item
    quotation.items.forEach((item, index) => {
        const { cost, profit } = calculateItemProfit(item);
        totalCost += cost;
        totalPrice += item.total;
        
        const itemRow = document.createElement('div');
        itemRow.className = 'mb-3 border-bottom pb-2';
        itemRow.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <strong>${item.type}</strong><br>
                    <small class="text-muted">${item.description}</small>
                </div>
                <div class="col-md-8">
                    <div class="row">
                        <div class="col-sm-4">
                            <small class="text-muted">Cost:</small><br>
                            ${formatCurrency(cost)}
                        </div>
                        <div class="col-sm-4">
                            <small class="text-muted">Price:</small><br>
                            ${formatCurrency(item.total)}
                        </div>
                        <div class="col-sm-4">
                            <small class="text-muted">Profit:</small><br>
                            ${formatCurrency(profit)}
                        </div>
                    </div>
                </div>
            </div>
        `;
        itemsContainer.appendChild(itemRow);
    });
    
    // Calculate totals
    const gst = totalPrice * 0.18;
    const totalWithGst = totalPrice + gst;
    const totalProfit = totalPrice - totalCost;
    const profitMargin = (totalProfit / totalPrice) * 100;
    const markup = ((totalPrice - totalCost) / totalCost) * 100;
    
    // Update summary
    document.getElementById('totalCost').textContent = formatCurrency(totalCost);
    document.getElementById('totalPrice').textContent = formatCurrency(totalPrice);
    document.getElementById('profitGst').textContent = formatCurrency(gst);
    document.getElementById('totalPriceGst').textContent = formatCurrency(totalWithGst);
    document.getElementById('totalProfit').textContent = formatCurrency(totalProfit);
    
    // Update analysis
    document.getElementById('profitMargin').textContent = `${profitMargin.toFixed(1)}%`;
    document.getElementById('markupPercentage').textContent = `${markup.toFixed(1)}%`;
    
    // Update progress bar
    const progressBar = document.getElementById('profitProgressBar');
    const progressPercentage = Math.min(100, (profitMargin / 30) * 100);
    progressBar.style.width = `${progressPercentage}%`;
    progressBar.className = `progress-bar ${profitMargin >= 30 ? 'bg-success' : profitMargin >= 20 ? 'bg-warning' : 'bg-danger'}`;
    
    // Show the details
    profitDetails.style.display = 'block';
}

// Add event listener for profit calculator quotation select
document.getElementById('profitQuotationSelect')?.addEventListener('change', async function(e) {
    const quotationId = e.target.value;
    if (!quotationId) {
        document.getElementById('profitDetails').style.display = 'none';
        return;
    }
    
    try {
        const response = await fetch(`/api/quotations/${quotationId}`);
        if (!response.ok) throw new Error('Failed to fetch quotation details');
        
        const quotation = await response.json();
        updateProfitAnalysis(quotation);
    } catch (error) {
        console.error('Error loading quotation details:', error);
        showAlert('Failed to load quotation details', 'danger');
        document.getElementById('profitDetails').style.display = 'none';
    }
});

// Add event listener for page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize navigation
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const pageId = link.getAttribute('data-page');
            showPage(pageId);
            
            // Load data based on page
            if (pageId === 'leads') {
                loadLeads();
            } else if (pageId === 'quotations') {
                loadQuotations();
            } else if (pageId === 'orders') {
                loadOrders();
            } else if (pageId === 'trainers') {
                loadTrainers();
            }
        });
    });
    
    // Initialize form buttons
    const newLeadBtn = document.getElementById('newLeadBtn');
    const newQuotationBtn = document.getElementById('newQuotationBtn');
    const newOrderBtn = document.getElementById('newOrderBtn');
    const cancelLeadBtn = document.getElementById('cancelLead');
    const cancelQuotationBtn = document.getElementById('cancelQuotation');
    const cancelOrderBtn = document.getElementById('cancelOrder');
    
    if (newLeadBtn) {
        newLeadBtn.addEventListener('click', showLeadForm);
    }
    
    if (newQuotationBtn) {
        newQuotationBtn.addEventListener('click', showQuotationForm);
    }
    
    if (newOrderBtn) {
        newOrderBtn.addEventListener('click', showOrderForm);
    }
    
    if (cancelLeadBtn) {
        cancelLeadBtn.addEventListener('click', () => {
            const leadFormCard = document.getElementById('leadFormCard');
            if (leadFormCard) {
                leadFormCard.style.display = 'none';
            }
        });
    }
    
    if (cancelQuotationBtn) {
        cancelQuotationBtn.addEventListener('click', () => {
            const quotationFormCard = document.getElementById('quotationFormCard');
            if (quotationFormCard) {
                quotationFormCard.style.display = 'none';
            }
        });
    }
    
    if (cancelOrderBtn) {
        cancelOrderBtn.addEventListener('click', hideOrderForm);
    }

    // Form submissions
    const leadForm = document.getElementById('leadForm');
    if (leadForm) {
        leadForm.addEventListener('submit', handleLeadSubmit);
    }

    // Show dashboard by default
    showPage('dashboard');
});

function formatCurrency(amount) {
    return `$${amount.toFixed(2)}`;
}

function parseCurrency(text) {
    return parseFloat(text.replace(/[^0-9.-]+/g, '')) || 0;
}

function addOrderItem() {
    const itemsContainer = document.getElementById('orderItems');
    if (!itemsContainer) return;
    
    const itemCount = itemsContainer.children.length + 1;
    
    const itemDiv = document.createElement('div');
    itemDiv.className = 'order-item mb-3 border p-3';
    
    const itemHtml = `
        <div class="row">
            <div class="col-md-12 mb-2">
                <label class="form-label">Item Description</label>
                <textarea class="form-control" name="item${itemCount}Description" rows="2" required></textarea>
            </div>
        </div>
        <div class="row">
            <div class="col-md-4 mb-2">
                <label class="form-label">Quantity</label>
                <input type="number" class="form-control order-cost-input" name="item${itemCount}Quantity" required oninput="calculateOrderItemTotal(this)">
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Unit Price</label>
                <input type="number" class="form-control order-cost-input" name="item${itemCount}Price" required oninput="calculateOrderItemTotal(this)">
            </div>
            <div class="col-md-4 mb-2">
                <label class="form-label">Total</label>
                <input type="text" class="form-control item-total" name="item${itemCount}Total" readonly>
            </div>
        </div>
        <div class="row mt-2">
            <div class="col-md-12">
                <button type="button" class="btn btn-danger btn-sm" onclick="removeOrderItem(this)">
                    <i class="bi bi-trash"></i> Remove Item
                </button>
            </div>
        </div>
    `;
    
    itemDiv.innerHTML = itemHtml;
    itemsContainer.appendChild(itemDiv);
}

function removeOrderItem(button) {
    button.closest('.order-item').remove();
    calculateOrderTotals();
}

function calculateOrderItemTotal(input) {
    const itemDiv = input.closest('.order-item');
    const quantity = parseFloat(itemDiv.querySelector('[name*="Quantity"]').value);
    const price = parseFloat(itemDiv.querySelector('[name*="Price"]').value);
    const total = quantity * price;
    
    itemDiv.querySelector('.item-total').value = formatCurrency(total).replace('$', '');
    calculateOrderTotals();
}

function calculateOrderTotals() {
    const items = document.querySelectorAll('.order-item');
    let subtotal = 0;
    
    items.forEach(item => {
        const totalInput = item.querySelector('.item-total');
        subtotal += parseCurrency(totalInput.value);
    });
    
    const gst = subtotal * 0.18;
    const total = subtotal + gst;
    
    document.getElementById('orderSubtotal').textContent = formatCurrency(subtotal);
    document.getElementById('orderGst').textContent = formatCurrency(gst);
    document.getElementById('orderTotal').textContent = formatCurrency(total);
}