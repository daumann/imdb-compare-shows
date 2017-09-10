import React, {Component} from 'react'
import PropTypes from 'prop-types'
import Avatar from 'material-ui/Avatar'
import SvgIconFace from 'material-ui/svg-icons/av/movie'
import SvgIconDownload from 'material-ui/svg-icons/file/file-download'
import IconButton from 'material-ui/IconButton'
import SearchBar from 'material-ui-search-bar'
import LinearProgress from 'material-ui/LinearProgress'
import Chip from 'material-ui/Chip'
import axios from 'axios'
import {Chart} from 'react-google-charts'
import debounce from 'lodash.debounce'
import ReactQueryParams from 'react-query-params'
import domtoimage from 'dom-to-image';
import FileSaver from 'file-saver';

const propTypes = {
    location: PropTypes.object.isRequired,
};

const progressColors = {
    inactive: "rgba(0,0,0,0)",
    pending: "rgb(0, 188, 212)",
    error: "rgb(212, 0, 0)",
}

const queryPresent = location.search !== ''
const apiKey = "29711e5c"
const omdbHost = "https://www.omdbapi.com/"
const waitForInput = 500

class ShowSearchAndPlot extends ReactQueryParams {
    constructor(props) {
        super(props);
        this.getShowSuggestions = debounce(this.getShowSuggestions, waitForInput);
        this.state = {
            progressMode: "indeterminate",
            progressColor: progressColors.inactive,
            value: "",
            chipData: [],
            availableShows: [],
            showDetails: {},
            chartHeight: window.innerHeight - 250,
            chartData: [
                ['Episode'],
            ]
        }
        this.styles = {
            chip: {
                margin: 4,
            },
            wrapper: {
                display: 'flex',
                flexWrap: 'wrap',
            }
        };

    }

    _startProgress = () => {
        this.setState({progressMode: "indeterminate", progressColor: progressColors.pending})
    }

    _finishProgress = () => {
        this.setState({progressMode: "indeterminate", progressColor: progressColors.inactive})
    }

    _errorProgress = () => {
        this.setState({progressMode: "determinate", progressColor: progressColors.error})
    }

    _resize = () => {
        this.setState({
            chartHeight: window.innerHeight - 250
        });
    };

    getShowSuggestions = (value) => {
        this._startProgress()
        axios.get(omdbHost + '?t=' + value + '&type=series&apikey=' + apiKey)
            .then(function (response) {
                const suggestion = response.data;
                this._finishProgress()
                if (typeof suggestion.Title !== "undefined") {
                    this.setState({availableShows: [suggestion.Title, suggestion.Title.toLowerCase()]})
                    this.setState({showDetails: suggestion})
                }
            }.bind(this))
            .catch(function (error) {
                this._errorProgress()
                console.log(error);
            }.bind(this));
    }
    _parseQueryString = () => {
        if (!queryPresent) return [];
        return location.search
            .replace('?', '')
            .split('&')
            .map(fvPair => fvPair.split('='))
            .map(pair => [pair[0], pair.slice(1).join('=')]);
    }

    componentDidMount = () => {
        window.addEventListener('resize', this._resize);
        this._resize();
        const queryParams = this._parseQueryString()
        for (let key of queryParams) {
            if (key[0] === "shows" && key[1] !== "") {
                this._addShow(key[1])
            }
        }
    }

    _addShow = (value) => {
        if (typeof value === "undefined" || value === "" || value === "undefined") {
            this._errorProgress()
            return
        }
        let newChipData = decodeURIComponent(value).split(",").reduce((result, show) => {
            if (show !== "undefined" && show !== "")
                result.push({"key": show, "label": show, "icon": ""})
                return result
            }, []
        )

        let showPromises = [];
        for (let i = 0; i < newChipData.length; i++) {
            showPromises.push(axios.get(omdbHost + '?t=' + newChipData[i].label + '&type=series&apikey=' + apiKey));
        }
        this._startProgress()
        axios.all(showPromises)
            .then(axios.spread((...args) => {
                this._finishProgress()
                for (let i = 0; i < args.length; i++) {
                    if (typeof args[i].data.Error !== "undefined") {
                        args.splice(i, 1);
                        newChipData.splice(i, 1);
                        this._errorProgress()
                        continue;
                    }
                    let showTitle = args[i].data.Title
                    newChipData[i].label = showTitle
                    newChipData[i].key = showTitle
                    newChipData[i].icon = args[i].data.Poster

                    let prevShows = this.queryParams.shows || ""
                    if (prevShows.indexOf(showTitle) === -1) {
                        this.setQueryParams({
                            shows: prevShows + ((prevShows === "") ? (showTitle) : ("," + showTitle))
                        });
                    }
                }

                const promiseSerial = funcs =>
                    funcs.reduce((promise, func) =>
                            promise.then(result => func().then(Array.prototype.concat.bind(result))),
                        Promise.resolve([]))

                const funcs = args.map(arg => () => this._handleNewShow(arg.data))

                this.setState({chipData: this.state.chipData.concat(newChipData)})

                // execute Promises in serial
                promiseSerial(funcs)
                    .then(function () {
                    }.bind(this))
                    .catch(function (error) {
                        this._errorProgress()
                        console.log(error);
                    }.bind(this))
            }))
            .catch(function (error) {
                this._errorProgress()
                console.log(error);
            }.bind(this))
    }

    handleRequestDelete = (key) => {
        this.chipData = this.state.chipData;
        const chipToDelete = this.chipData.map((chip) => chip.key).indexOf(key);
        this.chipData.splice(chipToDelete, 1);
        const prevChartData = this.state.chartData

        if (prevChartData[0].length < 3) {
            this.setState({
                chartData: [
                    ['Episode'],
                ]
            });
        } else {
            this.setState({
                chartData: prevChartData.map(
                    (row) => row.filter((elem, index) => (index !== chipToDelete + 1) && (index !== chipToDelete + 2) && (index !== chipToDelete + 3))
                )
            });
        }

        const prevShows = this.queryParams.shows || ""
        if (prevShows.indexOf(key) > -1) {
            const regKey = new RegExp(key, "g");
            const regKeyComma = new RegExp(key + ",", "g");
            this.setQueryParams({
                shows: prevShows.replace(regKeyComma, "").replace(regKey, "")
            });
        }

        this.setState({chipData: this.chipData})
    };

    renderChip(data) {
        return (
            <Chip
                key={data.key}
                onRequestDelete={() => this.handleRequestDelete(data.key)}
                style={this.styles.chip}
            >
                {(data.icon === "") ? (<Avatar color="#444" icon={<SvgIconFace />}/>)
                    : (<Avatar color="#444" src={data.icon}/>)
                }
                {data.label}
            </Chip>
        );
    }

    _handleSearchChange = (value) => {
        this.setState({value})
        this.getShowSuggestions(value);

        if (this.state.availableShows.indexOf(value) > -1) {
            this._addShow(value)
        }
    }

    _handleNewShow = (showDetails) => {
        return new Promise(
            (resolve, reject) => {
                if (typeof showDetails === "undefined") {
                    showDetails = this.state.showDetails
                }
                const showId = showDetails.imdbID
                const totalSeasons = +showDetails.totalSeasons
                if (isNaN(totalSeasons)) this._errorProgress()
                let seasonPromises = [];
                for (let i = 1; i <= totalSeasons; i++) {
                    this._startProgress()
                    seasonPromises.push(axios.get(omdbHost + '?i=' + showId + '&Season=' + i + '&apikey=' + apiKey));
                }
                axios.all(seasonPromises)
                    .then(axios.spread((...args) => {
                        let prevChartData = this.state.chartData
                        prevChartData[0].push(showDetails.Title + " (" + showDetails.imdbRating + ")")
                        prevChartData[0].push({ role: 'tooltip' })
                        prevChartData[0].push({ role: 'annotation' })
                        const prevChartRowLength = prevChartData.length - 1
                        const prevChartColLength = prevChartData[0].length
                        let rowCount = 1
                        for (let i = 0; i < args.length; i++) {
                            const currSeason = args[i].data
                            for (let j = 0; j < currSeason.Episodes.length; j++) {
                                if (rowCount >= prevChartRowLength) {
                                    // add dummy Episode id and suplement '_'
                                    prevChartData[rowCount] = [rowCount] // (i + 1) + "." + (j + 1)
                                    for (let c = 1; c < (prevChartColLength - 1)/3; c++) {
                                        prevChartData[rowCount].push(+"N/A")
                                        prevChartData[rowCount].push("n/a")
                                        prevChartData[rowCount].push(null)
                                    }
                                }
                                const imdbRating = +currSeason.Episodes[j].imdbRating
                                prevChartData[rowCount].push(imdbRating)
                                prevChartData[rowCount].push(currSeason.Episodes[j].Title + " (S" + currSeason.Season + "E" + currSeason.Episodes[j].Episode + "): " + currSeason.Episodes[j].imdbRating)
                                prevChartData[rowCount].push(null)
                                rowCount++
                            }
                        }
                        if (rowCount < prevChartRowLength) {
                            for (let r = rowCount; r <= prevChartRowLength; r++) {
                                prevChartData[r].push(+"N/A")
                                prevChartData[r].push("n/a")
                                prevChartData[r].push(null)
                            }
                        }
                        this._finishProgress()
                        this.setState({chartData: prevChartData})
                        resolve()
                    }).bind(this))
                    .then(() => {
                        let chartData = this.state.chartData
                        const lastIndex = chartData[0].length-1
                        const currRating = chartData[0].length-3
                        const minOfShow = chartData.reduce(function(prev, curr) {
                            return ((!isNaN(prev[currRating]) && (prev[currRating] < curr[currRating])) || isNaN(curr[currRating])) ? prev : curr;
                        })[0]
                        const maxOfShow = chartData.reduce(function(prev, curr) {
                            return ((!isNaN(prev[currRating]) && (prev[currRating] > curr[currRating])) || isNaN(curr[currRating])) ? prev : curr;
                        })[0]
                        chartData[minOfShow][lastIndex] = chartData[minOfShow][lastIndex-1]
                        chartData[maxOfShow][lastIndex] = chartData[maxOfShow][lastIndex-1]
                        this.setState({chartData})

                    })
                    .catch(function (error) {
                        this._errorProgress()
                        reject()
                    }.bind(this));
            }
        );
    }

    render() {
        return (
            <div>
                <SearchBar
                    hintText="Add shows to compare..."
                    dataSource={this.state.availableShows}
                    onChange={(value) => this._handleSearchChange(value)}
                    onRequestSearch={(value) => {
                        this.setState({value: ""})
                        this._addShow(this.state.value)
                    }}
                    value={this.state.value}
                    style={{
                        margin: '2em auto',
                        marginBottom: 0,
                        maxWidth: 800
                    }}
                />
                <LinearProgress value={100} mode={this.state.progressMode} color={this.state.progressColor} style={{
                    margin: '2em auto',
                    marginTop: 0,
                    marginBottom: '1em',
                    maxWidth: 800}} />
                <div style={this.styles.wrapper}>
                    {this.state.chipData.map(this.renderChip, this)}
                </div>
                <div style={{display: ''}}>
                    {(
                    this.state.chartData[0].length < 2 ||
                    this.state.chartData.length < 2 ||
                    this.state.chartData[1].length < 2) ? (
                            null
                        ) : (
                        <div>
                            <div id="imdbChart" style={{ backgroundColor: '#F0F0F0',
                                paddingBottom: '16px' }}>
                                <Chart
                                chartType="LineChart"
                                data={this.state.chartData}
                                chartEvents={[]}
                                loader={<div></div>}
                                options={{
                                    title: this.state.chartData[0].filter( (a,b) => (b-1)%3 === 0).join(", "),
                                    backgroundColor: '#F0F0F0',
                                    hAxis: {title: 'Episodes'},
                                    vAxis: {title: 'IMDB Rating'},
                                    trendlines: {
                                        0: {
                                            tooltip: false,
                                            lineWidth: 30,
                                            opacity: 0.2,
                                            type: 'polynomial'
                                        },
                                        1: {
                                            tooltip: false,
                                            lineWidth: 30,
                                            opacity: 0.2,
                                            type: 'polynomial'
                                        },
                                        2: {
                                            tooltip: false,
                                            lineWidth: 30,
                                            opacity: 0.2,
                                            type: 'polynomial'
                                        },
                                        3: {
                                            tooltip: false,
                                            lineWidth: 30,
                                            opacity: 0.2,
                                            type: 'polynomial'
                                        },
                                        4: {
                                            tooltip: false,
                                            lineWidth: 30,
                                            opacity: 0.2,
                                            type: 'polynomial'
                                        }  }
                                }}
                                graph_id="LineChart"
                                width={"100%"}
                                height={this.state.chartHeight + "px"}
                                />
                                <span style={{
                                    backgroundColor: '#F0F0F0',
                                    float: 'right',
                                    opacity: 0.4,
                                    fontSize: '14px',
                                    marginTop: '-16px',
                                    paddingRight: '24px'
                                }}>daumann.github.io/imdb-compare-shows</span>
                            </div>
                            <IconButton style={{float: 'left', marginTop: -60, opacity: 0.3}}
                                        hoveredStyle={{opacity: 0.8}}
                                        iconStyle={{width: 48, height: 48, margin: -16}}
                                        onClick={() => {
                                            domtoimage.toBlob(document.getElementById('imdbChart'))
                                                .then(function (blob) {
                                                    FileSaver.saveAs(blob, 'imdbChart.png');
                                                }.bind(this))
                                        }} tooltip="Download Chart as PNG">
                                <SvgIconDownload/>
                            </IconButton>
                        </div>

                        )}
                </div>
            </div>
        );
    }
}

ShowSearchAndPlot.propTypes = propTypes;
export default ShowSearchAndPlot;