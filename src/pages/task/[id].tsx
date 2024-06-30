import { ChangeEvent, FormEvent, useState } from "react";
import { useSession } from "next-auth/react";
import Head from "next/head";
import styles from "./styles.module.css";
import { GetServerSideProps } from "next";

import { db } from "../../services/firebaseConection";
import {
  doc,
  collection,
  query,
  where,
  getDoc,
  addDoc,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

import Textarea from "../../components/textarea/index";
import { FaTrash } from "react-icons/fa";
import { ToastContainer, Slide } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CustomToast } from "../../components/toast/customToast";
import Modal from "../../components/modal";

interface ITaskProps {
  item: {
    task: string;
    public: boolean;
    created: string;
    user: string;
    taskId: string;
  };
  allComments: ICommentsProps[];
}

interface ICommentsProps {
  id: string;
  comments: string;
  taskId: string;
  user: string;
  name: string;
}

export default function Task({ item, allComments }: ITaskProps) {
  const { data: session } = useSession();
  const [input, setInput] = useState("");
  const [comments, setComments] = useState<ICommentsProps[]>(allComments || []);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);

  const handleComment = async (event: FormEvent) => {
    event.preventDefault();

    if (input === "") {
      CustomToast({ message: "Informe o comentário", type: "warning" });
      return;
    }

    if (!session?.user?.email || !session?.user.name) return;

    try {
      const docRef = await addDoc(collection(db, "comments"), {
        comment: input,
        created: new Date(),
        user: session?.user.email,
        name: session?.user.name,
        taskId: item?.taskId,
      });

      const data = {
        id: docRef.id,
        comments: input,
        taskId: item?.taskId,
        user: session?.user.email,
        name: session?.user.name,
      };

      setComments((oldItems) => [...oldItems, data]);

      setInput("");
      CustomToast({
        message: "Comentário adicionado com sucesso!",
        type: "success",
      });
    } catch (err) {
      CustomToast({ message: "Erro ao adicionar comentário", type: "error" });
      console.log(err);
    }
  };

  const handleDeleteClick = (id: string) => {
    setCommentToDelete(id);
    setIsModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete) return;

    try {
      const docRef = doc(db, "comments", commentToDelete);

      await deleteDoc(docRef);

      const deleteComment = comments.filter(
        (item) => item.id !== commentToDelete
      );

      setComments(deleteComment);
      CustomToast({
        message: "Comentário removido com sucesso!",
        type: "error",
      });
    } catch (err) {
      CustomToast({ message: "Erro ao remover comentário", type: "error" });
      console.log(err);
    } finally {
      setIsModalOpen(false);
      setCommentToDelete(null);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCommentToDelete(null);
  };

  return (
    <div className={`${styles.container} container`}>
      <Head>
        <title>Detalhes da tarefa</title>
      </Head>

      <main className={`${styles.main} main`}>
        <h1>Tarefa</h1>

        <article className={`${styles.task} task`}>
          <p>{item.task}</p>
        </article>
      </main>

      <section className={`${styles.commentsContainer} commentsContainer`}>
        <h2>Deixar comentário</h2>

        <form onSubmit={handleComment}>
          <Textarea
            value={input}
            onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
              setInput(event.target.value)
            }
            placeholder="Deixe seu comentário"
          />

          <button
            className={`${styles.buttonComment} buttonComment`}
            disabled={!session?.user}
          >
            Enviar comentário
          </button>
        </form>
      </section>

      <section className={`${styles.commentsContainer} commentsContainer`}>
        <h2>Todos os comentários</h2>
        {comments.length === 0 && (
          <span>Nenhum comentário foi encontrado...</span>
        )}

        {comments.map((item) => (
          <article key={item.id} className={`${styles.comment} comment`}>
            <div className={`${styles.headComment}`}>
              <label className={`${styles.commentsLabel} commentsLabel`}>
                {item.name}
              </label>

              {item.user === session?.user?.email && (
                <button
                  className={`${styles.buttonTrash} buttonTrash`}
                  onClick={() => handleDeleteClick(item.id)}
                >
                  <FaTrash size={18} color="#EA3140" />
                </button>
              )}
            </div>
            <p>{item.comments}</p>
          </article>
        ))}
      </section>
      <Modal
        isOpen={isModalOpen}
        title="Confirmar Exclusão"
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
      >
        Tem certeza que deseja remover este comentário?
      </Modal>
      <ToastContainer transition={Slide} />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const id = params?.id as string;

  const docRef = doc(db, "tasks", id);

  const q = query(collection(db, "comments"), where("taskId", "==", id));

  const snapshotComments = await getDocs(q);

  let allComments: ICommentsProps[] = [];

  snapshotComments.forEach((doc) => {
    allComments.push({
      id: doc.id,
      comments: doc.data().comment,
      taskId: id,
      user: doc.data().user,
      name: doc.data().name,
    });
  });

  const snapshot = await getDoc(docRef);

  if (snapshot.data() === undefined) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  if (!snapshot.data()?.public) {
    return {
      redirect: {
        destination: "/",
        permanent: false,
      },
    };
  }

  const milliseconds = snapshot.data()?.created?.seconds * 1000;

  const task = {
    task: snapshot.data()?.task,
    public: snapshot.data()?.public,
    created: new Date(milliseconds).toLocaleDateString(),
    user: snapshot.data()?.user,
    taskId: id,
  };

  return {
    props: {
      item: task,
      allComments: allComments,
    },
  };
};
