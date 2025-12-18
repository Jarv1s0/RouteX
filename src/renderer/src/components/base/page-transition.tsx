import { motion } from 'framer-motion'
import React from 'react'

interface Props {
  children: React.ReactNode
}

const pageVariants = {
  initial: {
    opacity: 0
  },
  enter: {
    opacity: 1,
    transition: {
      duration: 0.15,
      ease: 'easeOut'
    }
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.1,
      ease: 'easeIn'
    }
  }
}

const PageTransition: React.FC<Props> = ({ children }) => {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  )
}

export default PageTransition
