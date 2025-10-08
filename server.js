const express = require('express');
   const cors = require('cors');
   require('dotenv').config();

   const app = express();
   const PORT = process.env.PORT || 5000;

   app.use(cors());
   app.use(express.json());

   // Health check
   app.get('/health', (req, res) => {
     res.json({ 
       status: 'healthy', 
       timestamp: new Date(),
       message: 'NYC Violations API is running!' 
     });
   });

   // Test endpoint
   app.get('/api/violations', (req, res) => {
     res.json({
       message: 'Violations endpoint',
       data: [
         { id: 1, business: 'Test Restaurant', agency: 'DOH', severity: 8 },
         { id: 2, business: 'Test Cafe', agency: 'DCWP', severity: 6 }
       ]
     });
   });

   app.listen(PORT, () => {
     console.log(`Server running on port ${PORT}`);
   });
