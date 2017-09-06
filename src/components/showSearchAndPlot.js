import React, {Component} from 'react'
import PropTypes from 'prop-types'
import Avatar from 'material-ui/Avatar'
import SvgIconFace from 'material-ui/svg-icons/av/movie'
import SearchBar from 'material-ui-search-bar'
import Chip from 'material-ui/Chip'
import axios from 'axios'
import {Chart} from 'react-google-charts'
import debounce from 'lodash.debounce'
import ReactQueryParams from 'react-query-params'

const propTypes = {
    location: PropTypes.object.isRequired,
};


const queryPresent = location.search !== '';
const apiKey = "29711e5c"
const omdbHost = "http://www.omdbapi.com/"
const waitForInput = 500

class ShowSearchAndPlot extends ReactQueryParams {
    constructor(props) {
        super(props);
        this.getShowSuggestions = debounce(this.getShowSuggestions, waitForInput);
        this.state = {
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

    _resize = () => {
        this.setState({
            chartHeight: window.innerHeight - 250
        });
    };

    getShowSuggestions = (value) => {
        axios.get(omdbHost + '?t=' + value + '&type=series&apikey=' + apiKey)
            .then(function (response) {
                const suggestion = response.data;
                if (typeof suggestion.Title !== "undefined") {
                    this.setState({availableShows: [suggestion.Title, suggestion.Title.toLowerCase()]})
                    this.setState({showDetails: suggestion})
                }
            }.bind(this))
            .catch(function (error) {
                console.log(error);
            });
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
                let chipData = decodeURIComponent(key[1]).split(",").reduce((result, show) => {
                        result.push({"key": show, "label": show, "icon": ""})
                        return result
                    }, []
                )


                let showPromises = [];
                for (let i = 0; i < chipData.length; i++) {
                    showPromises.push(axios.get(omdbHost + '?t=' + chipData[i].label + '&type=series&apikey=' + apiKey));
                }
                axios.all(showPromises)
                    .then(axios.spread((...args) => {
                        let showRenderPromises = [];
                        for (let i = 0; i < args.length; i++) {
                            chipData[i].icon = args[i].data.Poster
                        }

                        const promiseSerial = funcs =>
                            funcs.reduce((promise, func) =>
                                    promise.then(result => func().then(Array.prototype.concat.bind(result))),
                                Promise.resolve([]))

                        const funcs = args.map(arg => () => this._handleNewShow(arg.data))

                        // execute Promises in serial
                        promiseSerial(funcs)
                            .then()
                            .catch(console.error.bind(console))
                        this.setState({chipData})
                    }))

            }
        }
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
                    (row) => row.filter((elem, index) => index !== chipToDelete + 1)
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

        this.setState({chipData: this.chipData});
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
            const chipData = this.state.chipData.concat([{
                key: value,
                label: value,
                icon: this.state.showDetails.Poster
            }])
            this.setState({chipData})
            this.setState({value: ""})
            this._handleNewShow(this.state.showDetails)

            const prevShows = this.queryParams.shows || ""
            if (prevShows.indexOf(value) === -1) {
                this.setQueryParams({
                    shows: prevShows + ((prevShows === "") ? (value) : ("," + value))
                });
            }
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
                let prevChartData = this.state.chartData
                prevChartData[0].push(showDetails.Title + " (" + showDetails.imdbRating + ")")
                const prevChartRowLength = prevChartData.length - 1
                const prevChartColLength = prevChartData[0].length
                let seasonPromises = [];
                for (let i = 1; i <= totalSeasons; i++) {
                    seasonPromises.push(axios.get(omdbHost + '?i=' + showId + '&Season=' + i + '&apikey=' + apiKey));
                }
                axios.all(seasonPromises)
                    .then(axios.spread((...args) => {
                        let rowCount = 1;
                        for (let i = 0; i < args.length; i++) {
                            const currSeason = args[i].data
                            for (let j = 0; j < currSeason.Episodes.length; j++) {
                                if (rowCount >= prevChartRowLength) {
                                    // add dummy Episode id and suplement '_'
                                    prevChartData[rowCount] = [(i + 1) + "." + (j + 1)]
                                    for (let c = 1; c < prevChartColLength - 1; c++) {
                                        prevChartData[rowCount].push(+"N/A")
                                    }
                                }
                                prevChartData[rowCount].push(+currSeason.Episodes[j].imdbRating)
                                rowCount++;
                            }
                        }
                        if (rowCount < prevChartRowLength) {
                            for (let r = rowCount; r <= prevChartRowLength; r++) {
                                prevChartData[r].push(+"N/A")
                            }
                        }
                        this.setState({chartData: prevChartData})
                        resolve()
                    }).bind(this))
                    .catch(function (error) {
                        reject()
                    });
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
                    onRequestSearch={() => console.log('onRequestSearch')}
                    value={this.state.value}
                    style={{
                        margin: '2em auto',
                        maxWidth: 800
                    }}
                />
                <div style={this.styles.wrapper}>
                    {this.state.chipData.map(this.renderChip, this)}
                </div>
                <div style={{display: ''}}>
                    {(this.state.chartData.length < 2) ? (
                            null
                        ) : (
                            <Chart
                                chartType="LineChart"
                                data={this.state.chartData}
                                options={{
                                    backgroundColor: '#F0F0F0',
                                    hAxis: {title: 'Episodes'},
                                    vAxis: {title: 'IMDB Rating'}
                                }}
                                graph_id="LineChart"
                                width={"100%"}
                                height={this.state.chartHeight + "px"}
                                legend_toggle
                            />
                        )}
                </div>
            </div>
        );
    }
}

ShowSearchAndPlot.propTypes = propTypes;
export default ShowSearchAndPlot;