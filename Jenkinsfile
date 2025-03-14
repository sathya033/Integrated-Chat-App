// pipeline {
//     agent any
//     tools {nodejs "Node 23"}
//     stages {
//         stage('Build') {
//             steps {
//                 sh 'npm install'
//             }
//         }
//         stage('Deliver') {
//             steps {
//                 sh 'chmod -R +rwx ./jenkins/scripts/deliver.sh'
//                 sh 'chmod -R +rwx ./jenkins/scripts/kill.sh'
//                 sh './jenkins/scripts/deliver.sh'
//                 input message: 'Finished using the web site? (Click "Proceed" to continue)'
//                 sh './jenkins/scripts/kill.sh'
//             }
//         }
//     }
// }


pipeline {
    agent any
    tools { nodejs "Node 23" }

    stages {
        stage('Checkout Code') {
            steps {
                git 'https://github.com/sathya033/Integrated-Chat-App.git'
            }
        }
        stage('Install Dependencies') {
            steps {
                bat 'npm install'
            }
        }
        stage('Build Angular App') {
            steps {
                bat 'ng build --configuration=production'
            }
        }
        stage('Deploy App') {
            steps {
                bat 'npm run start &'
            }
        }
    }
}


