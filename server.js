// server.js
require('dotenv').config();
const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const ics = require('ics');
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Data storage paths
const STORAGE_PATH = path.join(__dirname, 'data', 'trainings.json');
const QUOTATIONS_PATH = path.join(__dirname, 'data', 'quotations.json');
const LEADS_PATH = path.join(__dirname, 'data', 'leads.json');
const REPORTS_PATH = path.join(__dirname, 'data', 'reports.json');
const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const QUOTATION_HISTORY_FILE = path.join(__dirname, 'data', 'quotation_history.json');
const TRAINERS_FILE = path.join(__dirname, 'data', 'trainers.json');
const TRAINER_POS_FILE = path.join(__dirname, 'data', 'trainer_pos.json');

// Initialize storage
async function initializeStorage() {
    try {
        await fs.mkdir(path.join(__dirname, 'data'), { recursive: true });
        const files = [
            STORAGE_PATH,
            QUOTATIONS_PATH,
            LEADS_PATH,
            REPORTS_PATH,
            ORDERS_FILE,
            QUOTATION_HISTORY_FILE,
            TRAINERS_FILE,
            TRAINER_POS_FILE
        ];

        for (const file of files) {
            try {
                await fs.access(file);
            } catch {
                await fs.writeFile(file, '[]');
            }
        }
    } catch (error) {
        console.error('Error initializing storage:', error);
    }
}

// Helper function to read JSON file
async function readJsonFile(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.writeFile(filePath, '[]');
            return [];
        }
        throw error;
    }
}

// Helper function to write JSON file
async function writeJsonFile(filePath, data) {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

// File operations
async function getTrainings() {
    const data = await readJsonFile(STORAGE_PATH);
    return JSON.parse(data);
}

async function saveTrainings(trainings) {
    await fs.writeFile(STORAGE_PATH, JSON.stringify(trainings, null, 2));
}

// CRUD Operations

// Quotation endpoints
app.post('/api/quotations', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        const newQuotation = {
            _id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        quotations.push(newQuotation);
        await writeJsonFile(QUOTATIONS_PATH, quotations);
        res.status(201).json(newQuotation);
    } catch (error) {
        console.error('Error creating quotation:', error);
        res.status(500).json({ error: 'Failed to create quotation' });
    }
});

app.get('/api/quotations', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        
        if (req.query.leadId) {
            // Filter quotations by lead ID if provided
            const filteredQuotations = quotations.filter(q => q.leadId === req.query.leadId);
            return res.json(filteredQuotations);
        }

        res.json(quotations);
    } catch (error) {
        console.error('Error reading quotations:', error);
        res.status(500).json({ error: 'Failed to retrieve quotations' });
    }
});

app.get('/api/quotations/:id', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        const quotation = quotations.find(q => q._id === req.params.id);
        
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        res.json(quotation);
    } catch (error) {
        console.error('Error retrieving quotation:', error);
        res.status(500).json({ error: 'Failed to retrieve quotation' });
    }
});

app.get('/api/quotations/:id/download', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        const quotation = quotations.find(q => q._id === req.params.id);
        
        if (!quotation) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        const pdfBuffer = await generateQuotationPDF(quotation);
        
        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Quotation-${quotation._id}.pdf`);
        res.setHeader('Content-Length', pdfBuffer.length);
        
        // Send the PDF buffer
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate quotation PDF' });
    }
});

app.patch('/api/quotations/:id/status', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        const index = quotations.findIndex(q => q._id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Quotation not found' });
        }
        
        quotations[index].status = req.body.status;
        await writeJsonFile(QUOTATIONS_PATH, quotations);
        res.json(quotations[index]);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update quotation status' });
    }
});

app.get('/api/quotations/:id/history', async (req, res) => {
    try {
        const history = await readJsonFile(QUOTATION_HISTORY_FILE) || [];
        const quotationHistory = history.filter(h => h.quotationId === req.params.id);
        res.json(quotationHistory);
    } catch (error) {
        console.error('Error reading quotation history:', error);
        res.status(500).json({ error: 'Failed to retrieve quotation history' });
    }
});

app.put('/api/quotations/:id', async (req, res) => {
    try {
        const quotations = await readJsonFile(QUOTATIONS_PATH) || [];
        const quotationIndex = quotations.findIndex(q => q._id === req.params.id);
        
        if (quotationIndex === -1) {
            return res.status(404).json({ error: 'Quotation not found' });
        }

        // Update quotation
        const updatedQuotation = {
            ...quotations[quotationIndex],
            ...req.body,
            lastModified: new Date().toISOString()
        };
        quotations[quotationIndex] = updatedQuotation;
        await writeJsonFile(QUOTATIONS_PATH, quotations);

        // Record edit history
        const history = await readJsonFile(QUOTATION_HISTORY_FILE) || [];
        history.push({
            quotationId: req.params.id,
            date: new Date().toISOString(),
            reason: req.body.editReason,
            editor: 'System User', // You can add user management later
            changes: req.body
        });
        await writeJsonFile(QUOTATION_HISTORY_FILE, history);

        res.json(updatedQuotation);
    } catch (error) {
        console.error('Error updating quotation:', error);
        res.status(500).json({ error: 'Failed to update quotation' });
    }
});

// Lead endpoints
app.get('/api/leads', async (req, res) => {
    try {
        const leads = await readJsonFile(LEADS_PATH) || [];
        res.json(leads);
    } catch (error) {
        console.error('Error reading leads:', error);
        res.status(500).json({ error: 'Failed to retrieve leads' });
    }
});

app.post('/api/leads', async (req, res) => {
    try {
        const leads = await readJsonFile(LEADS_PATH) || [];
        const newLead = {
            _id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };
        leads.push(newLead);
        await writeJsonFile(LEADS_PATH, leads);
        res.status(201).json(newLead);
    } catch (error) {
        console.error('Error creating lead:', error);
        res.status(500).json({ error: 'Failed to create lead' });
    }
});

// Orders API Endpoints
app.get('/api/orders', async (req, res) => {
    try {
        const orders = await readJsonFile(ORDERS_FILE);
        res.json(orders);
    } catch (error) {
        console.error('Error reading orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

app.post('/api/orders', async (req, res) => {
    try {
        const orders = await readJsonFile(ORDERS_FILE) || [];
        const newOrder = {
            _id: `order_${Date.now()}`,
            ...req.body,
            createdAt: new Date().toISOString()
        };
        
        orders.push(newOrder);
        await writeJsonFile(ORDERS_FILE, orders);
        
        res.status(201).json(newOrder);
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: 'Failed to create order' });
    }
});

app.get('/api/orders/:id', async (req, res) => {
    try {
        const orders = await readJsonFile(ORDERS_FILE);
        const order = orders.find(o => o._id === req.params.id);
        
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// Report endpoints
app.get('/api/reports/monthly', async (req, res) => {
    try {
        const trainings = await readJsonFile(STORAGE_PATH);
        const quotations = await readJsonFile(QUOTATIONS_PATH);
        const leads = await readJsonFile(LEADS_PATH);

        // Calculate monthly statistics
        const monthlyStats = calculateMonthlyStats(trainings, quotations, leads);
        res.json(monthlyStats);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate reports' });
    }
});

function calculateMonthlyStats(trainings, quotations, leads) {
    const last6Months = [];
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
        const month = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0);
        
        const monthlyTrainings = trainings.filter(t => {
            const date = new Date(t.createdAt);
            return date >= month && date <= monthEnd;
        });

        const revenue = monthlyTrainings.reduce((sum, t) => {
            const days = calculateDays(t.startDate, t.endDate);
            return sum + (days * (
                t.prices.trainerPerDay +
                t.prices.labPerDay +
                t.prices.platformPerDay
            ));
        }, 0);

        const costs = monthlyTrainings.reduce((sum, t) => {
            const days = calculateDays(t.startDate, t.endDate);
            return sum + (days * (
                t.costs.trainerPerDay +
                t.costs.labPerDay +
                t.costs.platformPerDay
            ));
        }, 0);

        last6Months.push({
            month: month.toLocaleString('default', { month: 'short' }),
            revenue,
            profit: revenue - costs,
            trainings: monthlyTrainings.length,
            quotations: quotations.filter(q => {
                const date = new Date(q.createdAt);
                return date >= month && date <= monthEnd;
            }).length,
            leads: leads.filter(l => {
                const date = new Date(l.createdAt);
                return date >= month && date <= monthEnd;
            }).length
        });
    }

    return last6Months;
}

function calculateDays(start, end) {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
}

// Generate PO PDF
function generatePO(training) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));

        doc.fontSize(20).text('Purchase Order', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Training ID: ${training.id}`);
        doc.text(`Client: ${training.clientName}`);
        doc.text(`Training Type: ${training.trainingType}`);
        doc.text(`Dates: ${training.startDate} to ${training.endDate}`);
        doc.text(`Trainer: ${training.trainer}`);
        
        doc.moveDown();
        doc.text('Cost Details (per day):');
        doc.text(`Trainer: $${training.costs.trainerPerDay}`);
        doc.text(`Lab: $${training.costs.labPerDay}`);
        doc.text(`Platform: $${training.costs.platformPerDay}`);
        
        doc.moveDown();
        doc.text('Sales Price (per day):');
        doc.text(`Trainer: $${training.prices.trainerPerDay}`);
        doc.text(`Lab: $${training.prices.labPerDay}`);
        doc.text(`Platform: $${training.prices.platformPerDay}`);

        doc.end();
    });
}

// API Routes
app.post('/api/training', async (req, res) => {
    try {
        const trainings = await getTrainings();
        const newTraining = {
            id: Date.now().toString(),
            ...req.body,
            status: 'Confirmed',
            createdAt: new Date().toISOString()
        };
        
        trainings.push(newTraining);
        await saveTrainings(trainings);

        // Send confirmation email
        const emailContent = `
            New Training Registration Confirmed
            
            Details:
            Client: ${newTraining.clientName}
            Training Type: ${newTraining.trainingType}
            Start Date: ${newTraining.startDate}
            End Date: ${newTraining.endDate}
            Trainer: ${newTraining.trainer}
        `;

        try {
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: newTraining.trainerEmail,
                subject: 'New Training Registration Confirmed',
                text: emailContent
            });
        } catch (emailErr) {
            console.error('Failed to send email:', emailErr);
            // Continue even if email fails
        }

        res.status(201).json(newTraining);
    } catch (err) {
        console.error('Error creating training:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/trainings', async (req, res) => {
    try {
        const trainings = await getTrainings();
        res.json(trainings);
    } catch (err) {
        console.error('Error fetching trainings:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/training/:id', async (req, res) => {
    try {
        const trainings = await getTrainings();
        const training = trainings.find(t => t.id === parseInt(req.params.id));
        
        if (!training) {
            return res.status(404).json({ error: 'Training not found' });
        }
        
        res.json(training);
    } catch (err) {
        console.error('Error fetching training:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/training/:id/details', async (req, res) => {
    try {
        const trainings = await getTrainings();
        const training = trainings.find(t => t.id === parseInt(req.params.id));
        
        if (!training) {
            return res.status(404).json({ error: 'Training not found' });
        }
        
        const details = {
            id: training.id,
            clientName: training.clientName,
            trainingType: training.trainingType,
            startDate: training.startDate,
            endDate: training.endDate,
            trainer: training.trainer,
            costs: training.costs,
            prices: training.prices
        };
        
        res.json(details);
    } catch (err) {
        console.error('Error fetching training details:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/training/:id', async (req, res) => {
    try {
        const trainings = await getTrainings();
        const index = trainings.findIndex(t => t.id === parseInt(req.params.id));
        if (index !== -1) {
            trainings[index] = { ...trainings[index], ...req.body };
            await saveTrainings(trainings);
            res.json(trainings[index]);
        } else {
            res.status(404).json({ error: 'Training not found' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trainer endpoints
app.get('/api/trainers', async (req, res) => {
    try {
        const trainers = await readJsonFile(TRAINERS_FILE);
        res.json(trainers || []);
    } catch (error) {
        console.error('Error reading trainers:', error);
        res.status(500).json({ error: 'Failed to retrieve trainers' });
    }
});

app.post('/api/trainers', async (req, res) => {
    try {
        let trainers = [];
        try {
            trainers = await readJsonFile(TRAINERS_FILE);
        } catch {
            trainers = [];
        }

        const newTrainer = {
            _id: Date.now().toString(),
            ...req.body,
            createdAt: new Date().toISOString()
        };

        trainers.push(newTrainer);
        await writeJsonFile(TRAINERS_FILE, trainers);
        res.status(201).json(newTrainer);
    } catch (error) {
        console.error('Error creating trainer:', error);
        res.status(500).json({ error: 'Failed to create trainer' });
    }
});

app.put('/api/trainers/:id', async (req, res) => {
    try {
        const trainers = await readJsonFile(TRAINERS_FILE);
        const index = trainers.findIndex(t => t._id === req.params.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Trainer not found' });
        }
        
        trainers[index] = {
            ...trainers[index],
            ...req.body,
            lastModified: new Date().toISOString()
        };
        
        await writeJsonFile(TRAINERS_FILE, trainers);
        res.json(trainers[index]);
    } catch (error) {
        console.error('Error updating trainer:', error);
        res.status(500).json({ error: 'Failed to update trainer' });
    }
});

// Trainer PO endpoints
app.post('/api/trainer-pos', async (req, res) => {
    try {
        const pos = await readJsonFile(TRAINER_POS_FILE);
        const newPO = {
            _id: Date.now().toString(),
            poNumber: `PO-${Date.now()}`,
            ...req.body,
            status: 'Pending',
            createdAt: new Date().toISOString()
        };
        
        // Calculate total amount
        const startDate = new Date(req.body.startDate);
        const endDate = new Date(req.body.endDate);
        const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        newPO.totalAmount = days * req.body.dailyRate;
        
        pos.push(newPO);
        await writeJsonFile(TRAINER_POS_FILE, pos);
        
        // Send email to trainer
        const trainer = (await readJsonFile(TRAINERS_FILE)).find(t => t._id === req.body.trainerId);
        if (trainer) {
            const emailContent = `
                Dear ${trainer.name},
                
                Please find attached the Purchase Order (${newPO.poNumber}) for the upcoming training.
                
                Training Details:
                - Start Date: ${req.body.startDate}
                - End Date: ${req.body.endDate}
                - Daily Rate: ₹${req.body.dailyRate}
                - Total Amount: ₹${newPO.totalAmount}
                
                Notes: ${req.body.notes || 'N/A'}
                
                Please confirm your acceptance of this PO.
                
                Best regards,
                Training Management System
            `;
            
            await transporter.sendMail({
                from: process.env.EMAIL_USER,
                to: trainer.email,
                subject: `Purchase Order ${newPO.poNumber}`,
                text: emailContent,
                // You can add PDF attachment here if needed
            });
        }
        
        res.status(201).json(newPO);
    } catch (error) {
        console.error('Error creating trainer PO:', error);
        res.status(500).json({ error: 'Failed to create trainer PO' });
    }
});

app.get('/api/trainer-pos', async (req, res) => {
    try {
        const pos = await readJsonFile(TRAINER_POS_FILE);
        res.json(pos);
    } catch (error) {
        console.error('Error reading trainer POs:', error);
        res.status(500).json({ error: 'Failed to retrieve trainer POs' });
    }
});

// Generate Quotation PDF
async function generateQuotationPDF(quotation) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4'
            });
            
            const chunks = [];
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            // Add company header
            doc.fontSize(24)
               .text('Training Management System', { align: 'center' })
               .moveDown(0.5);

            doc.fontSize(16)
               .text('QUOTATION', { align: 'center' })
               .moveDown();

            // Add quotation information
            doc.fontSize(12);
            
            // Quotation details
            doc.text(`Quotation #: ${quotation._id}`)
               .text(`Date: ${new Date(quotation.date).toLocaleDateString()}`)
               .moveDown();

            // Client details section
            doc.fontSize(14)
               .text('Client Details', { underline: true })
               .fontSize(12)
               .moveDown(0.5);
            
            doc.text(`Company: ${quotation.clientCompany}`)
               .text(`Contact Person: ${quotation.contactPerson}`)
               .text(`Email: ${quotation.email}`)
               .text(`Phone: ${quotation.phone}`)
               .moveDown();

            // Training details section
            doc.fontSize(14)
               .text('Training Details', { underline: true })
               .fontSize(12)
               .moveDown(0.5);
            
            doc.text(`Course: ${quotation.courseName}`)
               .text(`Number of Participants: ${quotation.participants}`)
               .text(`Duration: ${quotation.duration} days`)
               .moveDown();

            // Financial details section
            doc.fontSize(14)
               .text('Financial Details', { underline: true })
               .fontSize(12)
               .moveDown(0.5);
            
            doc.text(`Price per Day: $${quotation.pricePerDay.toLocaleString()}`)
               .text(`Total Value: $${quotation.totalValue.toLocaleString()}`)
               .moveDown();

            // Additional Notes
            if (quotation.notes) {
                doc.fontSize(14)
                   .text('Additional Notes', { underline: true })
                   .fontSize(12)
                   .moveDown(0.5)
                   .text(quotation.notes)
                   .moveDown();
            }

            // Terms and conditions
            doc.fontSize(14)
               .text('Terms and Conditions', { underline: true })
               .fontSize(10)
               .moveDown(0.5);
            
            doc.text('1. This quotation is valid for 30 days from the date of issue.')
               .text('2. Payment terms: 50% advance payment required to confirm the booking.')
               .text('3. Cancellation policy: Cancellations made less than 7 days before the training date will incur a 25% fee.');

            // Finalize the PDF
            doc.end();
        } catch (error) {
            reject(error);
        }
    });
}

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Initialize storage and start server
initializeStorage().then(() => {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('Failed to start server:', err);
});