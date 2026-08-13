# SP: pActualizarIntegracion
**Tipo**: Actualizar
**Módulo**: General

## Tablas Referenciadas
- [`saIntegr`](../tables/saIntegr.md)

## Código (excerpt)
```sql
/**************************************************************************************************************
NOMBRE: pActualizarIntegracion
DESCRIPCION: 
CREADO POR: SOFTECH SISTEMAS
***************************************************************************************************************/
CREATE PROCEDURE [pActualizarIntegracion]
    (
      @iInte_Num INT ,
      @iInte_NumOri INT ,
      @sdFec_Emis SMALLDATETIME ,
      @iOrde_Num INT ,
      @iMovb_Num INT ,
      @iCo_BenSocial INT ,
      @sDes_Inte VARCHAR(60) ,
      @sCo_Cont CHAR(12) ,
      @sdFec_Nomi SMALLDATETIME ,
      @bAgrupa BIT = NULL ,
      @bProcesada BIT ,
      @sConseId01 VARCHAR(20) = NULL ,
      @iConseNu01 INT = 0 ,
      @sConseId02 VARCHAR(20) = NULL ,
      @iConseNu02 INT = 0 ,
      @sConseId03 VARCHAR(20) = NULL ,
      @iConseNu03 INT = 0 ,
      @sConseId04 VARCHAR(20) = NULL ,
      @iConseNu04 INT = 0 ,
      @sConseId05 VARCHAR(20) = NULL ,
      @iConseNu05 INT = 0 ,
      @sConseId06 VARCHAR(20) = NULL ,
      @iConseNu06 INT = 0 ,
      @iTipo_Transf INT = 0 ,
      @sCampo1 VARCHAR(60) = NULL ,
      @sCampo2 VARCHAR(60) = NULL ,
      @sCampo3 VARCHAR(60) = NULL ,
      @sCampo4 VARCHAR(60) = NULL ,
      @sCampo5 VARCHAR(60) = NULL ,
      @sCampo6 VARCHAR(60) = NULL ,
      @sCampo7 VARCHAR(60) = NULL ,
      @sCampo8 VARCHAR(60) = NULL ,
      @sCo_Us_Mo CHAR(6) ,
      @sRevisado CHAR(1) = NULL ,
      @sTrasnfe CHAR(1) = NULL ,
      @tsValidador TIMESTAMP ,
      @gRowguid UNIQUEIDENTIFIER = NULL 		 
	
    )
AS 
    BEGIN  
        DECLARE @TableTimestamp TABLE
            (
              validador VARBINARY(MAX) ,
              fe_us_in DATETIME ,
              fe_us_mo DATETIME
            ) ;
        UPDATE
            saIntegr
        SET inte_num = @iInte_Num, fec_emis = @sdFec_Emis,
		 campo1 = @sCampo1, campo2 = @sCampo2, campo3 = @sCampo3, campo4 = @sCampo4,
            campo5 = @sCampo5, campo6 = @sCampo6, campo7 = @sCampo7, campo8 = @sCampo8, co_us_mo = @sCo_Us_Mo,
            fe_us_mo = GETDATE(), revisado = @sRevisado, trasnfe = @sTrasnfe
        OUTPUT
            inserted.validador, Inserted.fe_us_in, Inserted.fe_us_mo
            INTO @TableTimestamp
        WHERE
            inte_num = @iInte_NumOri
            AND validador = @tsValidador 

        SELECT
            *
        FROM
            @TableTimestamp
    END
```
