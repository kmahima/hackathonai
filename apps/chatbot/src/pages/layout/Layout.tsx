import { Outlet, NavLink, Link } from "react-router-dom";
import styles from "./Layout.module.css";

const Layout = () => {
    return (
        <div className={styles.layout}>
            <header className={styles.header} role={"banner"}>
                <div className={styles.headerContainer}>
                    <Link to="/" className={styles.headerTitleContainer}>
                        <h2 className={styles.headerTitle}>Anko Forger</h2>
                    </Link>
                </div>
            </header>

            <div className={styles.mainContainer}>
                <nav className={styles.sidenav}>
                    <ul className={styles.sidenavList}>
                        <li>
                            <NavLink
                                to="/ai-design-assistant"
                                className={`${styles.sidenavLink} ${styles.sidenavLinkAI}`}  // Hardcode selected styling
                            >
                                AI Design Assistant
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/collaboration"
                                className={({ isActive }) =>
                                    isActive
                                        ? `${styles.sidenavLink} ${styles.sidenavLinkActive}`
                                        : styles.sidenavLink
                                }
                            >
                                Collaboration
                            </NavLink>
                        </li>
                        <li>
                            <NavLink
                                to="/design-submissions"
                                className={({ isActive }) =>
                                    isActive
                                        ? `${styles.sidenavLink} ${styles.sidenavLinkActive}`
                                        : styles.sidenavLink
                                }
                            >
                                Design Submissions
                            </NavLink>
                        </li>
                    </ul>
                </nav>

                <div className={styles.content}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
};

export default Layout;
