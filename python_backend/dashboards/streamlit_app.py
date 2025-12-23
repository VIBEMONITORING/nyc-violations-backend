"""
Streamlit Dashboard for Luxury Watch Pricing Intelligence
Internal tool for filtering, analyzing, and exporting data
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
from decimal import Decimal
import requests

from sqlalchemy.orm import Session
from python_backend.database.db import get_db_context
from python_backend.models.models import (
    Watch, Brand, MarketplaceListing, PriceHistory,
    PriceCalculation, ParsedMessage
)
from python_backend.analytics.price_analyzer import PriceAnalyzer
from python_backend.config.config import settings

# Page configuration
st.set_page_config(
    page_title="Watch Pricing Intelligence",
    page_icon="⌚",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS
st.markdown("""
<style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 20px;
        border-radius: 10px;
        margin: 10px 0;
    }
    .opportunity {
        background-color: #d4edda;
        padding: 15px;
        border-radius: 5px;
        margin: 10px 0;
    }
</style>
""", unsafe_allow_html=True)


def main():
    """Main dashboard application"""

    # Title
    st.markdown('<h1 class="main-header">⌚ Luxury Watch Pricing Intelligence</h1>', unsafe_allow_html=True)

    # Sidebar navigation
    page = st.sidebar.selectbox(
        "Navigation",
        ["Dashboard", "Marketplace Listings", "Price Analysis", "Opportunities",
         "Message Parser", "Price History", "Export Data"]
    )

    if page == "Dashboard":
        show_dashboard()
    elif page == "Marketplace Listings":
        show_marketplace_listings()
    elif page == "Price Analysis":
        show_price_analysis()
    elif page == "Opportunities":
        show_opportunities()
    elif page == "Message Parser":
        show_message_parser()
    elif page == "Price History":
        show_price_history()
    elif page == "Export Data":
        show_export_data()


def show_dashboard():
    """Show main dashboard with summary statistics"""
    st.header("Dashboard Overview")

    with get_db_context() as db:
        # Summary metrics
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            total_watches = db.query(Watch).count()
            st.metric("Total Watches", f"{total_watches:,}")

        with col2:
            active_listings = db.query(MarketplaceListing).filter(
                MarketplaceListing.is_active == True
            ).count()
            st.metric("Active Listings", f"{active_listings:,}")

        with col3:
            total_brands = db.query(Brand).count()
            st.metric("Brands Tracked", total_brands)

        with col4:
            since_24h = datetime.utcnow() - timedelta(hours=24)
            recent_updates = db.query(PriceHistory).filter(
                PriceHistory.recorded_at >= since_24h
            ).count()
            st.metric("Price Updates (24h)", f"{recent_updates:,}")

        st.markdown("---")

        # Recent opportunities
        st.subheader("🎯 Top Opportunities (Last 24 Hours)")

        analyzer = PriceAnalyzer(db)
        opportunities = analyzer.find_buying_opportunities(max_results=10)

        if opportunities:
            opp_df = pd.DataFrame(opportunities)
            opp_df = opp_df[['brand', 'reference_number', 'current_price_usd',
                            'average_price_usd', 'discount_percent', 'marketplace']]
            opp_df.columns = ['Brand', 'Reference', 'Current Price', 'Avg Price',
                             'Discount %', 'Marketplace']

            st.dataframe(
                opp_df.style.highlight_max(subset=['Discount %'], color='lightgreen'),
                use_container_width=True
            )
        else:
            st.info("No significant opportunities found in the last 24 hours")

        st.markdown("---")

        # Price trends chart
        st.subheader("📈 Price Trends (Last 30 Days)")

        # Get top 5 most tracked watches
        from sqlalchemy import func
        top_watches = db.query(
            Watch.id,
            Watch.reference_number,
            Brand.name.label('brand_name'),
            func.count(PriceHistory.id).label('price_count')
        ).join(Brand).join(PriceHistory).group_by(
            Watch.id, Watch.reference_number, Brand.name
        ).order_by(func.count(PriceHistory.id).desc()).limit(5).all()

        if top_watches:
            chart_data = []
            since_30d = datetime.utcnow() - timedelta(days=30)

            for watch in top_watches:
                history = db.query(PriceHistory).filter(
                    PriceHistory.watch_id == watch.id,
                    PriceHistory.recorded_at >= since_30d
                ).order_by(PriceHistory.recorded_at).all()

                for record in history:
                    chart_data.append({
                        'Date': record.recorded_at,
                        'Price (USD)': float(record.price_usd) if record.price_usd else 0,
                        'Watch': f"{watch.brand_name} {watch.reference_number}"
                    })

            if chart_data:
                chart_df = pd.DataFrame(chart_data)
                fig = px.line(
                    chart_df,
                    x='Date',
                    y='Price (USD)',
                    color='Watch',
                    title='Price Trends - Top Tracked Watches'
                )
                st.plotly_chart(fig, use_container_width=True)


def show_marketplace_listings():
    """Show marketplace listings with filters"""
    st.header("Marketplace Listings")

    with get_db_context() as db:
        # Filters
        col1, col2, col3 = st.columns(3)

        with col1:
            brands = db.query(Brand.name).distinct().all()
            brand_options = ['All'] + [b[0] for b in brands]
            selected_brand = st.selectbox("Brand", brand_options)

        with col2:
            marketplace_options = ['All', 'chrono24', 'ebay']
            selected_marketplace = st.selectbox("Marketplace", marketplace_options)

        with col3:
            condition_options = ['All', 'new', 'unworn', 'very-good', 'good']
            selected_condition = st.selectbox("Condition", condition_options)

        col4, col5 = st.columns(2)

        with col4:
            min_price = st.number_input("Min Price (USD)", min_value=0, value=0)

        with col5:
            max_price = st.number_input("Max Price (USD)", min_value=0, value=100000)

        # Query listings
        query = db.query(MarketplaceListing).filter(
            MarketplaceListing.is_active == True
        )

        if selected_brand != 'All':
            query = query.join(Watch).join(Brand).filter(Brand.name == selected_brand)

        if selected_marketplace != 'All':
            query = query.filter(MarketplaceListing.marketplace == selected_marketplace)

        if selected_condition != 'All':
            query = query.filter(MarketplaceListing.condition == selected_condition)

        if min_price > 0:
            query = query.filter(MarketplaceListing.price_usd >= min_price)

        if max_price > 0:
            query = query.filter(MarketplaceListing.price_usd <= max_price)

        listings = query.order_by(MarketplaceListing.last_seen.desc()).limit(100).all()

        st.write(f"**Found {len(listings)} listings**")

        if listings:
            # Convert to DataFrame
            data = []
            for l in listings:
                data.append({
                    'Brand': l.watch.brand.name if l.watch and l.watch.brand else 'N/A',
                    'Reference': l.watch.reference_number if l.watch else 'N/A',
                    'Title': l.title[:50] + '...' if len(l.title) > 50 else l.title,
                    'Price (USD)': f"${float(l.price_usd):,.2f}" if l.price_usd else 'N/A',
                    'Condition': l.condition or 'N/A',
                    'Year': l.year or 'N/A',
                    'Marketplace': l.marketplace,
                    'Seller Trust': f"{float(l.seller.trust_score):.2f}" if l.seller and l.seller.trust_score else 'N/A',
                    'Last Seen': l.last_seen.strftime('%Y-%m-%d %H:%M'),
                    'URL': l.listing_url,
                })

            df = pd.DataFrame(data)
            st.dataframe(df, use_container_width=True)


def show_price_analysis():
    """Show price analysis for a specific watch"""
    st.header("Price Analysis")

    with get_db_context() as db:
        # Watch selection
        watches = db.query(Watch).join(Brand).limit(100).all()

        watch_options = {
            f"{w.brand.name} {w.reference_number}": w.id
            for w in watches if w.brand
        }

        selected_watch_label = st.selectbox("Select Watch", list(watch_options.keys()))

        if selected_watch_label:
            watch_id = watch_options[selected_watch_label]

            # Analysis parameters
            col1, col2 = st.columns(2)

            with col1:
                days_back = st.slider("Days of History", 7, 90, 30)

            with col2:
                condition = st.selectbox("Condition", ['All', 'new', 'unworn', 'very-good', 'good'])

            condition_filter = None if condition == 'All' else condition

            # Run analysis
            if st.button("Analyze"):
                with st.spinner("Analyzing..."):
                    analyzer = PriceAnalyzer(db)

                    try:
                        analysis = analyzer.analyze_watch_pricing(
                            watch_id,
                            condition_filter,
                            days_back
                        )

                        # Display results
                        st.subheader("Analysis Results")

                        # Current statistics
                        col1, col2, col3 = st.columns(3)

                        with col1:
                            st.metric(
                                "Floor Price",
                                f"${analysis['current_stats']['floor_price']:,.2f}"
                            )

                        with col2:
                            st.metric(
                                "Average Price",
                                f"${analysis['current_stats']['average_price']:,.2f}"
                            )

                        with col3:
                            st.metric(
                                "Ceiling Price",
                                f"${analysis['current_stats']['ceiling_price']:,.2f}"
                            )

                        # Trend information
                        st.markdown("---")
                        st.subheader("Price Trend")

                        col1, col2 = st.columns(2)

                        with col1:
                            trend_direction = analysis['trend']['direction']
                            trend_emoji = "📈" if trend_direction == "increasing" else "📉" if trend_direction == "decreasing" else "➡️"
                            st.info(f"{trend_emoji} **Trend:** {trend_direction.upper()}")

                        with col2:
                            change_percent = analysis['price_delta']['change_percent']
                            st.info(f"**Change:** {change_percent:+.2f}%")

                        # Recommendation
                        st.markdown("---")
                        st.subheader("Recommendation")

                        recommendation = analysis['recommendation']
                        confidence = float(analysis['confidence_score'])

                        if recommendation == 'strong_buy':
                            st.success(f"🎯 **STRONG BUY** (Confidence: {confidence:.0%})")
                        elif recommendation == 'buy':
                            st.success(f"✅ **BUY** (Confidence: {confidence:.0%})")
                        elif recommendation == 'hold_or_sell':
                            st.warning(f"⚠️ **HOLD OR SELL** (Confidence: {confidence:.0%})")
                        else:
                            st.info(f"ℹ️ **{recommendation.upper()}** (Confidence: {confidence:.0%})")

                    except Exception as e:
                        st.error(f"Error during analysis: {str(e)}")


def show_opportunities():
    """Show buying opportunities"""
    st.header("🎯 Buying Opportunities")

    with get_db_context() as db:
        # Filters
        col1, col2 = st.columns(2)

        with col1:
            brands = db.query(Brand.name).distinct().all()
            brand_options = ['All'] + [b[0] for b in brands]
            selected_brand = st.selectbox("Filter by Brand", brand_options)

        with col2:
            max_results = st.slider("Max Results", 10, 100, 50)

        if st.button("Find Opportunities"):
            with st.spinner("Searching for opportunities..."):
                analyzer = PriceAnalyzer(db)

                brand_filter = None if selected_brand == 'All' else selected_brand
                opportunities = analyzer.find_buying_opportunities(brand_filter, max_results)

                if opportunities:
                    st.success(f"Found {len(opportunities)} opportunities!")

                    for opp in opportunities:
                        with st.container():
                            st.markdown(f"""
                            <div class="opportunity">
                                <h4>{opp['brand']} {opp['reference_number']}</h4>
                                <p>
                                    <b>Current Price:</b> ${opp['current_price_usd']:,.2f} |
                                    <b>Average Price:</b> ${opp['average_price_usd']:,.2f} |
                                    <b>Discount:</b> <span style="color:green">{opp['discount_percent']:.1f}%</span>
                                </p>
                                <p>
                                    <b>Condition:</b> {opp['condition']} |
                                    <b>Marketplace:</b> {opp['marketplace']} |
                                    <b>Seller Trust:</b> {opp['seller_trust_score']:.2f if opp['seller_trust_score'] else 'N/A'}
                                </p>
                                <p><a href="{opp['listing_url']}" target="_blank">View Listing →</a></p>
                            </div>
                            """, unsafe_allow_html=True)
                else:
                    st.info("No opportunities found matching your criteria")


def show_message_parser():
    """Show message parsing interface"""
    st.header("📱 Message Parser")

    st.write("Paste watch listings from WhatsApp, Telegram, or other messaging platforms")

    # Input
    message_text = st.text_area(
        "Message Content",
        height=200,
        placeholder="Example:\nRolex 116500LN 2023 new 42k usd box papers\nAP 15400ST €38,000 unworn full set"
    )

    source = st.selectbox("Message Source", ["whatsapp", "telegram", "slack"])

    if st.button("Parse Message"):
        if message_text:
            from python_backend.parsers.message_parser import MessageParser

            with st.spinner("Parsing..."):
                parser = MessageParser()
                listings = parser.parse_message(message_text, source)

                if listings:
                    st.success(f"Parsed {len(listings)} listing(s)")

                    for i, listing in enumerate(listings, 1):
                        st.markdown(f"### Listing {i}")

                        col1, col2 = st.columns(2)

                        with col1:
                            st.write(f"**Brand:** {listing.brand or 'N/A'}")
                            st.write(f"**Reference:** {listing.reference_number or 'N/A'}")
                            st.write(f"**Model:** {listing.model or 'N/A'}")
                            st.write(f"**Year:** {listing.year or 'N/A'}")

                        with col2:
                            st.write(f"**Price:** {listing.price_amount} {listing.currency}" if listing.price_amount else "**Price:** N/A")
                            st.write(f"**Condition:** {listing.condition or 'N/A'}")
                            st.write(f"**Box:** {listing.has_box if listing.has_box is not None else 'Unknown'}")
                            st.write(f"**Papers:** {listing.has_papers if listing.has_papers is not None else 'Unknown'}")

                        # Confidence score
                        confidence = float(listing.confidence_score)
                        st.progress(confidence, text=f"Confidence: {confidence:.0%}")

                        st.markdown("---")
                else:
                    st.warning("No valid listings found in the message")
        else:
            st.error("Please enter a message to parse")


def show_price_history():
    """Show price history chart"""
    st.header("📊 Price History")

    with get_db_context() as db:
        # Watch selection
        watches = db.query(Watch).join(Brand).limit(100).all()

        watch_options = {
            f"{w.brand.name} {w.reference_number}": w.id
            for w in watches if w.brand
        }

        selected_watch_label = st.selectbox("Select Watch", list(watch_options.keys()))

        if selected_watch_label:
            watch_id = watch_options[selected_watch_label]

            days_back = st.slider("Days of History", 7, 180, 30)

            # Get history
            since_date = datetime.utcnow() - timedelta(days=days_back)

            history = db.query(PriceHistory).filter(
                PriceHistory.watch_id == watch_id,
                PriceHistory.recorded_at >= since_date
            ).order_by(PriceHistory.recorded_at).all()

            if history:
                # Create DataFrame
                data = [{
                    'Date': h.recorded_at,
                    'Price (USD)': float(h.price_usd) if h.price_usd else 0,
                    'Marketplace': h.marketplace,
                    'Condition': h.condition or 'Unknown'
                } for h in history]

                df = pd.DataFrame(data)

                # Plot
                fig = px.scatter(
                    df,
                    x='Date',
                    y='Price (USD)',
                    color='Marketplace',
                    size_max=10,
                    title=f'Price History - {selected_watch_label}'
                )

                # Add trend line
                fig.add_trace(
                    go.Scatter(
                        x=df['Date'],
                        y=df['Price (USD)'].rolling(window=5).mean(),
                        mode='lines',
                        name='5-point Moving Average',
                        line=dict(color='red', dash='dash')
                    )
                )

                st.plotly_chart(fig, use_container_width=True)

                # Statistics
                st.subheader("Statistics")
                col1, col2, col3, col4 = st.columns(4)

                with col1:
                    st.metric("Min Price", f"${df['Price (USD)'].min():,.2f}")

                with col2:
                    st.metric("Max Price", f"${df['Price (USD)'].max():,.2f}")

                with col3:
                    st.metric("Avg Price", f"${df['Price (USD)'].mean():,.2f}")

                with col4:
                    st.metric("Data Points", len(df))

            else:
                st.info("No price history available for this watch")


def show_export_data():
    """Show data export interface"""
    st.header("💾 Export Data")

    with get_db_context() as db:
        export_type = st.selectbox(
            "Select Data to Export",
            ["Marketplace Listings", "Price History", "Opportunities", "Parsed Messages"]
        )

        if export_type == "Marketplace Listings":
            listings = db.query(MarketplaceListing).filter(
                MarketplaceListing.is_active == True
            ).limit(1000).all()

            data = [{
                'Brand': l.watch.brand.name if l.watch and l.watch.brand else 'N/A',
                'Reference': l.watch.reference_number if l.watch else 'N/A',
                'Title': l.title,
                'Price_USD': float(l.price_usd) if l.price_usd else None,
                'Condition': l.condition,
                'Year': l.year,
                'Marketplace': l.marketplace,
                'Last_Seen': l.last_seen,
            } for l in listings]

            df = pd.DataFrame(data)

        elif export_type == "Opportunities":
            analyzer = PriceAnalyzer(db)
            opportunities = analyzer.find_buying_opportunities(max_results=100)
            df = pd.DataFrame(opportunities)

        if st.button("Generate CSV"):
            csv = df.to_csv(index=False)
            st.download_button(
                label="Download CSV",
                data=csv,
                file_name=f"{export_type.lower().replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.csv",
                mime="text/csv"
            )

            st.success("CSV generated successfully!")


if __name__ == "__main__":
    main()
