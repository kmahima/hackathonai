import React, { useState } from 'react';
import styles from './Approval.module.css';
import image1 from '../../assets/images/image1.jpeg';
import image2 from '../../assets/images/image2.jpeg';
import image3 from '../../assets/images/image3.jpeg';

const Approval = () => {
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const images = [
        { id: 1, image: image1, designedBy: 'Designer A', designedAt: '2023-01-01', fabric: 'Denim 100%', sustainableOptions: 'Organic cotton chiffon, Tencel, Polyester chiffon' },
        { id: 2, image: image2, designedBy: 'Designer B', designedAt: '2023-02-01', fabric: 'Cotton 80%, Polyester 20%', sustainableOptions: 'Tencel' },
        { id: 3, image: image3, designedBy: 'Designer C', designedAt: '2023-03-01', fabric: 'Polyester 100%', sustainableOptions: 'Polyester chiffon' },
        { id: 4, image: image1, designedBy: 'Designer A', designedAt: '2023-01-01', fabric: 'Denim 100%', sustainableOptions: 'Organic cotton chiffon, Tencel, Polyester chiffon' },
        { id: 5, image: image2, designedBy: 'Designer B', designedAt: '2023-02-01', fabric: 'Cotton 80%, Polyester 20%', sustainableOptions: 'Tencel' },
        { id: 6, image: image3, designedBy: 'Designer C', designedAt: '2023-03-01', fabric: 'Polyester 100%', sustainableOptions: 'Polyester chiffon' },
        { id: 7, image: image1, designedBy: 'Designer A', designedAt: '2023-01-01', fabric: 'Denim 100%', sustainableOptions: 'Organic cotton chiffon, Tencel, Polyester chiffon' },
        { id: 8, image: image2, designedBy: 'Designer B', designedAt: '2023-02-01', fabric: 'Cotton 80%, Polyester 20%', sustainableOptions: 'Tencel' },
        { id: 9, image: image3, designedBy: 'Designer C', designedAt: '2023-03-01', fabric: 'Polyester 100%', sustainableOptions: 'Polyester chiffon' },
        { id: 10, image: image1, designedBy: 'Designer A', designedAt: '2023-01-01', fabric: 'Denim 100%', sustainableOptions: 'Organic cotton chiffon, Tencel, Polyester chiffon' },
        { id: 11, image: image2, designedBy: 'Designer B', designedAt: '2023-02-01', fabric: 'Cotton 80%, Polyester 20%', sustainableOptions: 'Tencel' },
        { id: 12, image: image3, designedBy: 'Designer C', designedAt: '2023-03-01', fabric: 'Polyester 100%', sustainableOptions: 'Polyester chiffon' }
    ];

    const handleApprove = (image: string) => {
        console.log(`Approved: ${image}`);
        setSelectedImage(null);
    };

    const handleReject = (image: string) => {
        console.log(`Rejected: ${image}`);
        setSelectedImage(null);
    };

    const handleRevise = (image: string) => {
        console.log(`Revised: ${image}`);
        setSelectedImage(null);
    };

    const selectedImageData = images.find(img => img.image === selectedImage);

    return (
        <div className={styles.container}>
            <h1>Design Submissions</h1>
            <div className={styles.cards}>
                {images.map((image, idx) => (
                    <div key={idx} className={styles.card} onClick={() => setSelectedImage(image.image)}>
                        <img src={image.image} alt={`Image ${idx}`} />
                        <div className={styles.cardInfo}>
                            <p>Designed by: {image.designedBy}</p>
                            <p>Designed at: {image.designedAt}</p>
                        </div>
                    </div>
                ))}
            </div>
            {selectedImage && (
                <div className={`${styles.modal} ${styles.show}`} onClick={() => setSelectedImage(null)}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalRow}>
                            <img src={selectedImage} alt="Selected" className={styles.modalImage} />
                            <div className={styles.modalInfo}>
                                <p>Designed by: {selectedImageData?.designedBy}</p>
                                <p>Designed at: {selectedImageData?.designedAt}</p>
                                <p>Fabric: {selectedImageData?.fabric}</p>
                                <p>Sustainable Options: {selectedImageData?.sustainableOptions}</p>
                            </div>
                        </div>
                        <div className={styles.modalButtons}>
                            <button className={`${styles.button} ${styles.approve}`} onClick={() => handleApprove(selectedImage)}>Approve</button>
                            <button className={`${styles.button} ${styles.reject}`} onClick={() => handleReject(selectedImage)}>Reject</button>
                            <button className={`${styles.button} ${styles.revise}`} onClick={() => handleRevise(selectedImage)}>Revise</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Approval;