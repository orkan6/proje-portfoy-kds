
document.addEventListener('DOMContentLoaded', async () => {
    await loadPortfolios();
    setupEventListeners();
    setupCharts();
});


async function loadPortfolios() {
    try {
        const response = await fetch('/api/portfolios');
        const portfolios = await response.json();
        
        const select = document.getElementById('portfolioSelect');
        select.innerHTML = '<option value="">Portföy seçiniz...</option>' +
            portfolios.map(p => `
                <option value="${p.portfolio_id}">${p.portfolio_name}</option>
            `).join('');
    } catch (error) {
        console.error('Portföy listesi yüklenirken hata:', error);
    }
}


function setupEventListeners() {
    
    document.getElementById('portfolioSelect').addEventListener('change', async (e) => {
        const portfolioId = e.target.value;
        if (portfolioId) {
            await loadPortfolioAnalysis(portfolioId);
        }
    });

    
    document.querySelectorAll('.metric-card').forEach(card => {
        card.addEventListener('click', () => {
            card.classList.toggle('active');
        });
    });
}


async function loadPortfolioAnalysis(portfolioId) {
    try {
        
        const response = await fetch(`/api/portfolios/${portfolioId}/analysis`);
        if (!response.ok) throw new Error('Analiz verisi alınamadı');
        const analysis = await response.json();
        
        
        const perfResponse = await fetch(`/api/portfolios/${portfolioId}/performance`);
        if (!perfResponse.ok) throw new Error('Performans verisi alınamadı');
        const performance = await perfResponse.json();
        
        
        updateMetrics(analysis);
        
        
        updatePerformanceChart('performanceChart', performance);
        
        
        updateRiskMetrics(analysis);
        
        
        await updateCorrelationMatrix(portfolioId);
    } catch (error) {
        console.error('Analiz yüklenirken hata:', error);
    }
}


function updatePerformanceChart(chartId, performanceData) {
    const ctx = document.getElementById(chartId)?.getContext('2d');
    if (!ctx) return;

    const existingChart = Chart.getChart(ctx);
    if (existingChart) {
        existingChart.destroy();
    }

    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: performanceData.dates,
            datasets: [
                {
                    label: 'Portföy Performansı',
                    data: performanceData.portfolio,
                    borderColor: '#4CAF50',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0
                },
                {
                    label: 'S&P 500',
                    data: performanceData.market,
                    borderColor: '#2196F3',
                    tension: 0.1,
                    fill: false,
                    pointRadius: 0,
                    borderDash: [5, 5]
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Portföy Performans Karşılaştırması (Baz 100)'
                },
                legend: {
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'month',
                        displayFormats: {
                            month: 'MMM yyyy'
                        }
                    },
                    title: {
                        display: true,
                        text: 'Tarih'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Performans (Baz 100)'
                    },
                    ticks: {
                        callback: value => value.toFixed(0)
                    }
                }
            }
        }
    });
}


function setupCharts() {
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.color = '#64748b';
        Chart.defaults.scale.grid.color = '#e2e8f0';
    }
}


function updateMetrics(analysis) {
    try {
        
        const expectedReturn = analysis.expectedReturn || 0;
        const expectedReturnElement = document.getElementById('expectedReturnCurrent');
        if (expectedReturnElement) {
            expectedReturnElement.textContent = `${(expectedReturn * 100).toFixed(2)}%`;
        }
        
        
        const volatility = analysis.volatility || 0;
        const volatilityElement = document.getElementById('volatilityCurrent');
        if (volatilityElement) {
            volatilityElement.textContent = `${(volatility * 100).toFixed(2)}%`;
        }
        
        
        const sharpeRatio = analysis.sharpeRatio || 0;
        const sharpeElement = document.getElementById('sharpeRatioCurrent');
        if (sharpeElement) {
            sharpeElement.textContent = sharpeRatio.toFixed(2);
        }
        
        
        const treynorRatio = analysis.treynorRatio || 0;
        const treynorElement = document.getElementById('treynorRatioCurrent');
        if (treynorElement) {
            treynorElement.textContent = treynorRatio.toFixed(2);
        }
    } catch (error) {
        console.error('Metrik güncelleme hatası:', error);
    }
}


function updateRiskMetrics(analysis) {
    try {
        if (!analysis.metrics) return;

        
        const betaElement = document.getElementById('betaValue');
        if (betaElement) {
            betaElement.textContent = (analysis.metrics.beta || 0).toFixed(2);
        }

        
        const alphaElements = {
            'alphaValue': analysis.metrics.alpha,
            'alpha6M': analysis.metrics.alpha6M,
            'alpha3M': analysis.metrics.alpha3M
        };

        Object.entries(alphaElements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value ? `${(value * 100).toFixed(2)}%` : '-';
            }
        });
    } catch (error) {
        console.error('Risk metrikleri güncelleme hatası:', error);
    }
}


async function updateCorrelationMatrix(portfolioId) {
    try {
        const response = await fetch(`/api/portfolios/${portfolioId}/correlation`);
        if (!response.ok) throw new Error('Korelasyon verisi alınamadı');
        const data = await response.json();

        const table = document.getElementById('correlationMatrix');
        if (!table) return;

        
        let headerRow = '<th></th>';
        data.symbols.forEach(symbol => {
            headerRow += `<th>${symbol}</th>`;
        });

        
        let rows = '';
        data.matrix.forEach((row, i) => {
            rows += `<tr>
                <td>${data.symbols[i]}</td>
                ${row.map(value => {
                    let cellClass = '';
                    if (value === 1) cellClass = 'correlation-perfect';
                    else if (value >= 0.7) cellClass = 'correlation-high-positive';
                    else if (value >= 0.3) cellClass = 'correlation-moderate-positive';
                    else if (value > -0.3) cellClass = 'correlation-neutral';
                    else if (value > -0.7) cellClass = 'correlation-moderate-negative';
                    else cellClass = 'correlation-high-negative';
                    
                    return `<td class="${cellClass}">${value}</td>`;
                }).join('')}
            </tr>`;
        });

        
        table.innerHTML = `
            <thead>
                <tr>${headerRow}</tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        `;

    } catch (error) {
        console.error('Korelasyon matrisi güncelleme hatası:', error);
    }
}