# 🚀 Deploy WaitNot to Render

## Step-by-Step Deployment Guide

### 1. Prerequisites
- ✅ Code pushed to GitHub
- ✅ Render account (free at render.com)

### 2. Render Configuration

#### Create New Web Service
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub account
4. Select your `Waitnot` repository

#### Build & Deploy Settings
```
Name: waitnot-restaurant
Environment: Node
Region: Oregon (US West) or closest to your restaurant
Branch: main
Build Command: npm run render-build
Start Command: npm start
```

#### Environment Variables
```
NODE_ENV=production
PORT=10000
```

### 3. Advanced Settings (Optional)

#### Auto-Deploy
- ✅ Enable "Auto-Deploy" for automatic updates when you push to GitHub

#### Health Check Path
```
Health Check Path: /api/restaurants
```

### 4. Domain Setup

#### Free Subdomain
Your app will be available at:
```
https://waitnot-restaurant.onrender.com
```

#### Custom Domain (Optional)
1. Go to Settings → Custom Domains
2. Add your domain (e.g., `yourrestaurant.com`)
3. Update DNS records as shown

### 5. Database Considerations

#### Current Setup (JSON Files)
- ✅ Works perfectly on Render
- ✅ Data persists between deployments
- ✅ No additional setup needed

#### Upgrade to PostgreSQL (Later)
```bash
# Add to your Render service
DATABASE_URL=postgresql://user:pass@host:port/db
```

### 6. Monitoring & Logs

#### View Logs
1. Go to your service dashboard
2. Click "Logs" tab
3. Monitor real-time application logs

#### Performance Metrics
- CPU usage
- Memory usage
- Response times
- Error rates

### 7. Scaling Options

#### Free Tier Limits
- ✅ Perfect for single restaurant
- ✅ Handles 50-100 concurrent users
- ✅ 750 hours/month (always on)

#### Paid Tier Benefits ($7/month)
- More CPU and memory
- Faster builds
- Priority support
- Custom domains

### 8. Backup Strategy

#### Automatic Backups
Render automatically backs up your service, but for data:

```bash
# Download your data periodically
curl https://your-app.onrender.com/api/backup
```

#### Manual Backup
1. Go to your restaurant dashboard
2. Download analytics reports
3. Export menu data

### 9. SSL Certificate

#### Automatic HTTPS
- ✅ Render provides free SSL certificates
- ✅ Automatic renewal
- ✅ All traffic encrypted

### 10. Troubleshooting

#### Common Issues

**Build Fails**
```bash
# Check build logs for errors
# Usually missing dependencies or wrong Node version
```

**App Won't Start**
```bash
# Check start command is correct: npm start
# Verify PORT environment variable
```

**Database Issues**
```bash
# Check file permissions
# Verify data directory exists
```

#### Getting Help
1. Check Render documentation
2. View service logs
3. Contact Render support (very responsive)

### 11. Post-Deployment Checklist

#### Test Core Features
- [ ] Restaurant login works
- [ ] Menu displays correctly
- [ ] QR codes generate and work
- [ ] Orders can be placed
- [ ] Real-time updates work
- [ ] Printing functions work
- [ ] Analytics display data

#### Performance Check
- [ ] Page load times < 3 seconds
- [ ] API responses < 500ms
- [ ] WebSocket connections stable
- [ ] Mobile responsiveness good

#### Security Verification
- [ ] HTTPS enabled
- [ ] Admin areas protected
- [ ] No sensitive data exposed
- [ ] CORS configured correctly

### 12. Going Live

#### Soft Launch
1. Test with staff orders
2. Verify all features work
3. Train restaurant staff
4. Test during quiet hours

#### Full Launch
1. Update QR codes on tables
2. Announce to customers
3. Monitor for issues
4. Collect feedback

### 13. Maintenance

#### Regular Updates
```bash
# Push updates to GitHub
git add .
git commit -m "Update: feature description"
git push origin main
# Render auto-deploys
```

#### Monitoring
- Check logs weekly
- Monitor performance metrics
- Review customer feedback
- Update menu items regularly

---

## 🎉 Your Restaurant is Now Live!

Your WaitNot system is now deployed and ready to serve customers. The system will handle:

- ✅ Customer orders via QR codes
- ✅ Real-time order management
- ✅ Payment processing
- ✅ Kitchen and receipt printing
- ✅ Business analytics and reports

**Next Steps:**
1. Train your staff on the system
2. Print QR codes for tables
3. Start taking orders!
4. Monitor and optimize based on usage

**Support:** If you need help, check the logs in Render dashboard or refer to the main README.md file.